import { pool } from "./pool";
import bcrypt from "bcrypt";
import { logger } from "../utils/logger";
import dotenv from "dotenv";

dotenv.config();

async function seed() {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // ── Users ──────────────────────────────────────────────
    logger.info("Seeding users...");

    const hash = async (pw: string) => bcrypt.hash(pw, 10);

    const users = await Promise.all([
      client.query(
        `INSERT INTO users (email, password_hash)
         VALUES ('admin@example.com', $1)
         ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash
         RETURNING id, email`,
        [await hash("admin123")]
      ),
      client.query(
        `INSERT INTO users (email, password_hash)
         VALUES ('approver@example.com', $1)
         ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash
         RETURNING id, email`,
        [await hash("approver123")]
      ),
      client.query(
        `INSERT INTO users (email, password_hash)
         VALUES ('user@example.com', $1)
         ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash
         RETURNING id, email`,
        [await hash("user123")]
      ),
      client.query(
        `INSERT INTO users (email, password_hash)
         VALUES ('manager@example.com', $1)
         ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash
         RETURNING id, email`,
        [await hash("manager123")]
      ),
    ]);

    const [admin, approver, regularUser, manager] = users.map((r) => r.rows[0]);

    // ── Tenant 1: Nexora Labs ────────────────────────────────
    logger.info("Seeding Tenant 1: Nexora Labs...");

    const t1Result = await client.query(
      `INSERT INTO tenants (name) VALUES ('Nexora Labs')
       ON CONFLICT DO NOTHING RETURNING id`
    );
    const t1Id =
      t1Result.rows[0]?.id ??
      (await client.query(`SELECT id FROM tenants WHERE name = 'Nexora Labs'`)).rows[0].id;

    // Roles in Nexora Labs:
    //   admin@example.com   → ADMIN
    //   approver@example.com → APPROVER
    //   user@example.com     → USER
    //   manager@example.com  → APPROVER
    for (const [userId, role] of [
      [admin.id, "ADMIN"],
      [approver.id, "APPROVER"],
      [regularUser.id, "USER"],
      [manager.id, "APPROVER"],
    ] as const) {
      await client.query(
        `INSERT INTO tenant_members (user_id, tenant_id, role)
         VALUES ($1, $2, $3)
         ON CONFLICT (user_id, tenant_id) DO UPDATE SET role = $3`,
        [userId, t1Id, role]
      );
    }

    // Nexora Labs workflow: Document Approval
    // Draft → Under Review (direct) → Approved | Rejected (SINGLE approval by APPROVER)
    const wf1 = await client.query(
      `INSERT INTO workflows (tenant_id, name) VALUES ($1, 'Document Approval')
       RETURNING id`,
      [t1Id]
    );
    const wf1Id = wf1.rows[0].id;

    const [s1Draft, s1Review, s1Approved, s1Rejected] = await Promise.all([
      client.query(
        `INSERT INTO workflow_states (workflow_id, name, is_initial, is_final) VALUES ($1, 'Draft', true, false) RETURNING id`,
        [wf1Id]
      ),
      client.query(
        `INSERT INTO workflow_states (workflow_id, name, is_initial, is_final) VALUES ($1, 'Under Review', false, false) RETURNING id`,
        [wf1Id]
      ),
      client.query(
        `INSERT INTO workflow_states (workflow_id, name, is_initial, is_final) VALUES ($1, 'Approved', false, true) RETURNING id`,
        [wf1Id]
      ),
      client.query(
        `INSERT INTO workflow_states (workflow_id, name, is_initial, is_final) VALUES ($1, 'Rejected', false, true) RETURNING id`,
        [wf1Id]
      ),
    ]);

    // Draft → Under Review (direct)
    await client.query(
      `INSERT INTO workflow_transitions (workflow_id, from_state_id, to_state_id, requires_approval, approval_strategy)
       VALUES ($1, $2, $3, false, 'NONE')`,
      [wf1Id, s1Draft.rows[0].id, s1Review.rows[0].id]
    );
    // Under Review → Approved (SINGLE approval)
    await client.query(
      `INSERT INTO workflow_transitions (workflow_id, from_state_id, to_state_id, requires_approval, approval_strategy, required_approvals, required_role)
       VALUES ($1, $2, $3, true, 'SINGLE', 1, 'APPROVER')`,
      [wf1Id, s1Review.rows[0].id, s1Approved.rows[0].id]
    );
    // Under Review → Rejected (SINGLE approval)
    await client.query(
      `INSERT INTO workflow_transitions (workflow_id, from_state_id, to_state_id, requires_approval, approval_strategy, required_approvals, required_role)
       VALUES ($1, $2, $3, true, 'SINGLE', 1, 'APPROVER')`,
      [wf1Id, s1Review.rows[0].id, s1Rejected.rows[0].id]
    );

    // Sample items in Nexora Labs
    await client.query(
      `INSERT INTO items (tenant_id, workflow_id, current_state_id, created_by, title) VALUES ($1, $2, $3, $4, $5)`,
      [t1Id, wf1Id, s1Draft.rows[0].id, admin.id, "Q1 Budget Report"]
    );
    await client.query(
      `INSERT INTO items (tenant_id, workflow_id, current_state_id, created_by, title) VALUES ($1, $2, $3, $4, $5)`,
      [t1Id, wf1Id, s1Draft.rows[0].id, regularUser.id, "Employee Handbook v2"]
    );

    // ── Tenant 2: Veltrix Co ───────────────────────────────
    logger.info("Seeding Tenant 2: Veltrix Co...");

    const t2Result = await client.query(
      `INSERT INTO tenants (name) VALUES ('Veltrix Co')
       ON CONFLICT DO NOTHING RETURNING id`
    );
    const t2Id =
      t2Result.rows[0]?.id ??
      (await client.query(`SELECT id FROM tenants WHERE name = 'Veltrix Co'`)).rows[0].id;

    // Roles in Veltrix Co (note: different roles for same users!)
    //   admin@example.com    → USER       (not admin here!)
    //   manager@example.com  → ADMIN
    //   approver@example.com → APPROVER
    for (const [userId, role] of [
      [admin.id, "USER"],
      [manager.id, "ADMIN"],
      [approver.id, "APPROVER"],
    ] as const) {
      await client.query(
        `INSERT INTO tenant_members (user_id, tenant_id, role)
         VALUES ($1, $2, $3)
         ON CONFLICT (user_id, tenant_id) DO UPDATE SET role = $3`,
        [userId, t2Id, role]
      );
    }

    // Veltrix Co workflow: Purchase Request
    // New → Manager Review (direct) → Finance Approval (ALL approvers) → Completed | Denied
    const wf2 = await client.query(
      `INSERT INTO workflows (tenant_id, name) VALUES ($1, 'Purchase Request')
       RETURNING id`,
      [t2Id]
    );
    const wf2Id = wf2.rows[0].id;

    const [s2New, s2ManagerReview, s2Completed, s2Denied] = await Promise.all([
      client.query(
        `INSERT INTO workflow_states (workflow_id, name, is_initial, is_final) VALUES ($1, 'New', true, false) RETURNING id`,
        [wf2Id]
      ),
      client.query(
        `INSERT INTO workflow_states (workflow_id, name, is_initial, is_final) VALUES ($1, 'Manager Review', false, false) RETURNING id`,
        [wf2Id]
      ),
      client.query(
        `INSERT INTO workflow_states (workflow_id, name, is_initial, is_final) VALUES ($1, 'Completed', false, true) RETURNING id`,
        [wf2Id]
      ),
      client.query(
        `INSERT INTO workflow_states (workflow_id, name, is_initial, is_final) VALUES ($1, 'Denied', false, true) RETURNING id`,
        [wf2Id]
      ),
    ]);

    // New → Manager Review (direct)
    await client.query(
      `INSERT INTO workflow_transitions (workflow_id, from_state_id, to_state_id, requires_approval, approval_strategy)
       VALUES ($1, $2, $3, false, 'NONE')`,
      [wf2Id, s2New.rows[0].id, s2ManagerReview.rows[0].id]
    );
    // Manager Review → Completed (ALL approvers must approve)
    await client.query(
      `INSERT INTO workflow_transitions (workflow_id, from_state_id, to_state_id, requires_approval, approval_strategy, required_approvals, required_role)
       VALUES ($1, $2, $3, true, 'ALL', 1, 'APPROVER')`,
      [wf2Id, s2ManagerReview.rows[0].id, s2Completed.rows[0].id]
    );
    // Manager Review → Denied (SINGLE approval)
    await client.query(
      `INSERT INTO workflow_transitions (workflow_id, from_state_id, to_state_id, requires_approval, approval_strategy, required_approvals, required_role)
       VALUES ($1, $2, $3, true, 'SINGLE', 1, 'APPROVER')`,
      [wf2Id, s2ManagerReview.rows[0].id, s2Denied.rows[0].id]
    );

    // Sample item in Veltrix Co
    await client.query(
      `INSERT INTO items (tenant_id, workflow_id, current_state_id, created_by, title) VALUES ($1, $2, $3, $4, $5)`,
      [t2Id, wf2Id, s2New.rows[0].id, admin.id, "Office Supplies Order"]
    );

    await client.query("COMMIT");

    logger.info("Seed completed!");
    logger.info("─── Test accounts ───");
    logger.info("admin@example.com    / admin123    → ADMIN in Nexora, USER in Veltrix");
    logger.info("approver@example.com / approver123 → APPROVER in both tenants");
    logger.info("user@example.com     / user123     → USER in Nexora only");
    logger.info("manager@example.com  / manager123  → APPROVER in Nexora, ADMIN in Veltrix");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch((err) => {
  logger.error({ err }, "Seed failed");
  process.exit(1);
});
