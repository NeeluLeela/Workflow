import { pool } from "../db/pool";
import { logger } from "../utils/logger";

export const runSlaChecker = async (): Promise<void> => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const breachResult = await client.query(`
      WITH candidates AS (
        SELECT
          i.id           AS item_id,
          i.tenant_id,
          i.current_state_id AS state_id,
          sr.id          AS sla_rule_id,
          sr.deadline_hours,
          sr.escalation_role,
          (
            SELECT al.created_at
            FROM audit_logs al
            WHERE al.entity_id = i.id
              AND al.action_type IN ('CREATED', 'STATE_CHANGED')
            ORDER BY al.created_at DESC
            LIMIT 1
          ) AS entered_state_at
        FROM items i
        JOIN sla_rules sr
          ON sr.workflow_id = i.workflow_id
         AND sr.state_id    = i.current_state_id
         AND sr.tenant_id   = i.tenant_id
        JOIN workflow_states ws ON ws.id = i.current_state_id
        WHERE ws.is_final = false
          AND NOT EXISTS (
            SELECT 1 FROM sla_breaches sb
            WHERE sb.item_id  = i.id
              AND sb.state_id = i.current_state_id
          )
      ),
      breached AS (
        SELECT * FROM candidates
        WHERE entered_state_at IS NOT NULL
          AND now() - entered_state_at > deadline_hours * interval '1 hour'
      ),
      inserted_breaches AS (
        INSERT INTO sla_breaches (tenant_id, item_id, sla_rule_id, state_id)
        SELECT tenant_id, item_id, sla_rule_id, state_id FROM breached
        ON CONFLICT (item_id, state_id) DO NOTHING
        RETURNING item_id, tenant_id, deadline_hours, escalation_role
      )
      INSERT INTO audit_logs
        (tenant_id, entity_type, entity_id, action_type, performed_by, metadata)
      SELECT
        ib.tenant_id,
        'ITEM',
        ib.item_id,
        'SLA_BREACHED',
        (
          SELECT u.id FROM users u
          JOIN tenant_members tm ON tm.user_id = u.id
          WHERE tm.tenant_id = ib.tenant_id AND tm.role = 'ADMIN'
          LIMIT 1
        ),
        json_build_object('deadlineHours', ib.deadline_hours, 'escalationRole', ib.escalation_role)::text
      FROM inserted_breaches ib
      WHERE EXISTS (
        SELECT 1 FROM users u
        JOIN tenant_members tm ON tm.user_id = u.id
        WHERE tm.tenant_id = ib.tenant_id AND tm.role = 'ADMIN'
      )
    `);

    const detected = breachResult.rowCount ?? 0;

    await client.query(`
      INSERT INTO audit_logs
        (tenant_id, entity_type, entity_id, action_type, performed_by, metadata)
      SELECT
        sb.tenant_id,
        'ITEM',
        sb.item_id,
        'SLA_ESCALATED',
        (
          SELECT u.id FROM users u
          JOIN tenant_members tm ON tm.user_id = u.id
          WHERE tm.tenant_id = sb.tenant_id AND tm.role = sr.escalation_role
          LIMIT 1
        ),
        json_build_object('escalationRole', sr.escalation_role)::text
      FROM sla_breaches sb
      JOIN sla_rules sr ON sr.id = sb.sla_rule_id
      WHERE sb.escalated = false
        AND sb.tenant_id = sr.tenant_id
        AND EXISTS (
          SELECT 1 FROM users u
          JOIN tenant_members tm ON tm.user_id = u.id
          WHERE tm.tenant_id = sb.tenant_id AND tm.role = sr.escalation_role
        )
    `);

    const escalateResult = await client.query(`
      UPDATE sla_breaches sb
      SET escalated = true, escalated_at = now()
      FROM sla_rules sr
      WHERE sb.sla_rule_id = sr.id
        AND sb.escalated   = false
        AND sb.tenant_id   = sr.tenant_id
        AND EXISTS (
          SELECT 1 FROM users u
          JOIN tenant_members tm ON tm.user_id = u.id
          WHERE tm.tenant_id = sb.tenant_id AND tm.role = sr.escalation_role
        )
    `);

    const escalated = escalateResult.rowCount ?? 0;

    await client.query("COMMIT");

    if (detected > 0 || escalated > 0) {
      logger.info({ detected, escalated }, "SLA check completed");
    }
  } catch (err) {
    await client.query("ROLLBACK");
    logger.error({ err }, "SLA checker error");
  } finally {
    client.release();
  }
};

export const startSlaJob = (intervalMs = 5 * 60 * 1000): NodeJS.Timeout => {
  logger.info({ intervalSeconds: intervalMs / 1000 }, "SLA checker starting");
  runSlaChecker();
  return setInterval(runSlaChecker, intervalMs);
};
