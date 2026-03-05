import { Response } from "express";
import { pool } from "../../db/pool";
import { AuthRequest } from "../../types/express";
import { createSlaRuleSchema } from "./sla.schema";
import { NotFoundError } from "../../utils/errors";
import { paginationSchema, paginationToSql, buildPaginatedResult } from "../../utils/pagination";

export const createSlaRule = async (req: AuthRequest, res: Response) => {
  const { workflowId, stateId, deadlineHours, escalationRole } = createSlaRuleSchema.parse(req.body);

  const wfCheck = await pool.query(
    `SELECT 1 FROM workflows WHERE id = $1 AND tenant_id = $2`,
    [workflowId, req.tenantId]
  );
  if ((wfCheck.rowCount ?? 0) === 0) {
    throw new NotFoundError("Workflow", workflowId);
  }

  const stateCheck = await pool.query(
    `SELECT 1 FROM workflow_states WHERE id = $1 AND workflow_id = $2`,
    [stateId, workflowId]
  );
  if ((stateCheck.rowCount ?? 0) === 0) {
    throw new NotFoundError("State", stateId);
  }

  const result = await pool.query(
    `INSERT INTO sla_rules (tenant_id, workflow_id, state_id, deadline_hours, escalation_role)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (tenant_id, workflow_id, state_id)
     DO UPDATE SET deadline_hours = $4, escalation_role = $5
     RETURNING *`,
    [req.tenantId, workflowId, stateId, deadlineHours, escalationRole]
  );

  return res.status(201).json(result.rows[0]);
};

export const listSlaRules = async (req: AuthRequest, res: Response) => {
  const pagination = paginationSchema.parse(req.query);
  const { limit, offset } = paginationToSql(pagination);

  const [rows, count] = await Promise.all([
    pool.query(
      `SELECT sr.*, ws.name AS state_name, w.name AS workflow_name
       FROM sla_rules sr
       JOIN workflow_states ws ON ws.id = sr.state_id
       JOIN workflows w ON w.id = sr.workflow_id
       WHERE sr.tenant_id = $1
       ORDER BY w.name, ws.name
       LIMIT $2 OFFSET $3`,
      [req.tenantId, limit, offset]
    ),
    pool.query(
      `SELECT COUNT(*) FROM sla_rules WHERE tenant_id = $1`,
      [req.tenantId]
    ),
  ]);

  return res.json(buildPaginatedResult(rows.rows, parseInt(count.rows[0].count), pagination));
};

export const deleteSlaRule = async (req: AuthRequest, res: Response) => {
  const result = await pool.query(
    `DELETE FROM sla_rules WHERE id = $1 AND tenant_id = $2 RETURNING id`,
    [req.params.id, req.tenantId]
  );

  if ((result.rowCount ?? 0) === 0) {
    throw new NotFoundError("SLA rule", req.params.id as string);
  }

  return res.json({ message: "SLA rule deleted" });
};

export const listSlaBreaches = async (req: AuthRequest, res: Response) => {
  const pagination = paginationSchema.parse(req.query);
  const { limit, offset } = paginationToSql(pagination);

  const [rows, count] = await Promise.all([
    pool.query(
      `SELECT
         sb.id, sb.item_id, i.title AS item_title,
         sb.breached_at, sb.escalated, sb.escalated_at,
         ws.name AS state_name, sr.deadline_hours, sr.escalation_role
       FROM sla_breaches sb
       JOIN items i ON i.id = sb.item_id
       JOIN sla_rules sr ON sr.id = sb.sla_rule_id
       JOIN workflow_states ws ON ws.id = sb.state_id
       WHERE sb.tenant_id = $1
       ORDER BY sb.breached_at DESC
       LIMIT $2 OFFSET $3`,
      [req.tenantId, limit, offset]
    ),
    pool.query(
      `SELECT COUNT(*) FROM sla_breaches WHERE tenant_id = $1`,
      [req.tenantId]
    ),
  ]);

  return res.json(buildPaginatedResult(rows.rows, parseInt(count.rows[0].count), pagination));
};
