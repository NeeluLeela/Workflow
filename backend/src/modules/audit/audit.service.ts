import { PoolClient } from "pg";
import { pool } from "../../db/pool";
import { logger } from "../../utils/logger";

interface CreateAuditLogParams {
  tenantId?: string;
  actorId?: string;
  action: string;
  entityType?: string;
  entityId?: string;
  beforeState?: Record<string, unknown>;
  afterState?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export async function createAuditLog(
  params: CreateAuditLogParams,
  client?: PoolClient
): Promise<void> {
  const queryFn = client ?? pool;
  try {
    await queryFn.query(
      `INSERT INTO audit_logs
       (tenant_id, entity_type, entity_id, action_type, performed_by, metadata, before_state, after_state)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        params.tenantId ?? null,
        params.entityType ?? null,
        params.entityId ?? null,
        params.action,
        params.actorId ?? null,
        params.metadata ? JSON.stringify(params.metadata) : null,
        params.beforeState ? JSON.stringify(params.beforeState) : null,
        params.afterState ? JSON.stringify(params.afterState) : null,
      ]
    );
  } catch (err) {
    logger.error({ err, params }, "Failed to create audit log");
  }
}

export async function getAuditLogs(
  tenantId: string,
  filters: {
    actionType?: string;
    entityType?: string;
    entityId?: string;
    actorId?: string;
    from?: string;
    to?: string;
  },
  pagination: { limit: number; offset: number }
) {
  const conditions: string[] = ["al.tenant_id = $1"];
  const params: unknown[] = [tenantId];
  let idx = 2;

  if (filters.actionType) {
    conditions.push(`al.action_type = $${idx++}`);
    params.push(filters.actionType);
  }
  if (filters.entityType) {
    conditions.push(`al.entity_type = $${idx++}`);
    params.push(filters.entityType);
  }
  if (filters.entityId) {
    conditions.push(`al.entity_id = $${idx++}`);
    params.push(filters.entityId);
  }
  if (filters.actorId) {
    conditions.push(`al.performed_by = $${idx++}`);
    params.push(filters.actorId);
  }
  if (filters.from) {
    conditions.push(`al.created_at >= $${idx++}`);
    params.push(filters.from);
  }
  if (filters.to) {
    conditions.push(`al.created_at <= $${idx++}`);
    params.push(filters.to);
  }

  const where = conditions.join(" AND ");

  const [rows, count] = await Promise.all([
    pool.query(
      `SELECT al.id, al.entity_type, al.entity_id, al.action_type,
              al.metadata, al.before_state, al.after_state, al.created_at,
              u.email AS performed_by_email,
              i.title AS item_title
       FROM audit_logs al
       LEFT JOIN users u ON u.id = al.performed_by
       LEFT JOIN items i ON i.id = al.entity_id AND al.entity_type = 'ITEM'
       WHERE ${where}
       ORDER BY al.created_at DESC
       LIMIT $${idx} OFFSET $${idx + 1}`,
      [...params, pagination.limit, pagination.offset]
    ),
    pool.query(
      `SELECT COUNT(*) FROM audit_logs al WHERE ${where}`,
      params
    ),
  ]);

  return {
    data: rows.rows,
    total: parseInt(count.rows[0].count),
  };
}
