import { pool, withTransaction } from "../../db/pool";
import { NotFoundError, ValidationError } from "../../utils/errors";
import { createAuditLog } from "../audit/audit.service";
import { logger } from "../../utils/logger";

export async function createTenant(name: string, userId: string) {
  return withTransaction(async (client) => {
    const tenantResult = await client.query(
      `INSERT INTO tenants (name)
       VALUES ($1)
       RETURNING id, name, created_at`,
      [name]
    );

    const tenant = tenantResult.rows[0];

    await client.query(
      `INSERT INTO tenant_members (user_id, tenant_id, role)
       VALUES ($1, $2, 'ADMIN')`,
      [userId, tenant.id]
    );

    await createAuditLog({
      tenantId: tenant.id,
      actorId: userId,
      action: "TENANT_CREATED",
      entityType: "TENANT",
      entityId: tenant.id,
      metadata: { name },
    }, client);

    logger.info({ tenantId: tenant.id, userId }, "Tenant created");
    return tenant;
  });
}

export async function getMyTenants(userId: string) {
  const result = await pool.query(
    `SELECT t.id, t.name, t.created_at, tm.role
     FROM tenants t
     JOIN tenant_members tm ON t.id = tm.tenant_id
     WHERE tm.user_id = $1`,
    [userId]
  );

  return result.rows;
}

export async function listTenantMembers(tenantId: string) {
  const result = await pool.query(
    `SELECT tm.id, u.id AS user_id, u.email, tm.role, tm.created_at
     FROM tenant_members tm
     JOIN users u ON u.id = tm.user_id
     WHERE tm.tenant_id = $1
     ORDER BY tm.created_at ASC`,
    [tenantId]
  );

  return result.rows;
}

export async function addTenantMember(
  tenantId: string,
  email: string,
  role: string,
  actorId: string
) {
  return withTransaction(async (client) => {
    const userResult = await client.query(
      `SELECT id FROM users WHERE email = $1`,
      [email]
    );
    if ((userResult.rowCount ?? 0) === 0) {
      throw new NotFoundError("User", email);
    }

    const targetUserId = userResult.rows[0].id;

    await client.query(
      `INSERT INTO tenant_members (user_id, tenant_id, role)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, tenant_id) DO UPDATE SET role = $3`,
      [targetUserId, tenantId, role]
    );

    await createAuditLog({
      tenantId,
      actorId,
      action: "MEMBER_ADDED",
      entityType: "TENANT",
      entityId: tenantId,
      metadata: { email, role, targetUserId },
    }, client);

    logger.info({ tenantId, email, role }, "Tenant member added");
    return { message: "Member added successfully" };
  });
}

export async function removeTenantMember(
  tenantId: string,
  targetUserId: string,
  actorId: string
) {
  if (targetUserId === actorId) {
    throw new ValidationError("Cannot remove yourself");
  }

  await pool.query(
    `DELETE FROM tenant_members WHERE user_id = $1 AND tenant_id = $2`,
    [targetUserId, tenantId]
  );

  logger.info({ tenantId, targetUserId }, "Tenant member removed");
  return { message: "Member removed" };
}
