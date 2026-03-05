import { pool, withTransaction } from "../../db/pool";
import { ConflictError, NotFoundError, ValidationError } from "../../utils/errors";
import { createAuditLog } from "../audit/audit.service";
import { logger } from "../../utils/logger";
import { PaginationParams, paginationToSql, buildPaginatedResult } from "../../utils/pagination";

interface CreateWorkflowInput {
  name: string;
  states: { name: string; isInitial?: boolean; isFinal?: boolean }[];
  transitions?: {
    fromState: string;
    toState: string;
    requiresApproval: boolean;
    approvalStrategy: string;
    requiredApprovals?: number;
    requiredRole?: string;
  }[];
}

export async function createWorkflow(
  input: CreateWorkflowInput,
  tenantId: string,
  actorId: string
) {
  const { name, states, transitions } = input;

  const initialStates = states.filter((s) => s.isInitial);
  if (initialStates.length !== 1) {
    throw new ValidationError("Exactly one initial state is required");
  }

  return withTransaction(async (client) => {
    const existing = await client.query(
      `SELECT id FROM workflows WHERE tenant_id = $1 AND name = $2 AND is_active = true`,
      [tenantId, name]
    );
    if ((existing.rowCount ?? 0) > 0) {
      throw new ConflictError(`Workflow '${name}' already exists in this tenant`);
    }

    const wfResult = await client.query(
      `INSERT INTO workflows (tenant_id, name)
       VALUES ($1, $2)
       RETURNING id`,
      [tenantId, name]
    );

    const workflowId = wfResult.rows[0].id;
    const stateMap: Record<string, string> = {};

    for (const state of states) {
      const stateResult = await client.query(
        `INSERT INTO workflow_states
         (workflow_id, name, is_initial, is_final)
         VALUES ($1, $2, $3, $4)
         RETURNING id`,
        [workflowId, state.name, state.isInitial || false, state.isFinal || false]
      );
      stateMap[state.name] = stateResult.rows[0].id;
    }

    if (transitions) {
      for (const t of transitions) {
        if (!stateMap[t.fromState] || !stateMap[t.toState]) {
          throw new ValidationError("Invalid transition state reference");
        }

        await client.query(
          `INSERT INTO workflow_transitions
           (workflow_id, from_state_id, to_state_id,
            requires_approval, approval_strategy, required_approvals, required_role)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            workflowId,
            stateMap[t.fromState],
            stateMap[t.toState],
            t.requiresApproval,
            t.approvalStrategy,
            t.requiredApprovals || 1,
            t.requiredRole || null,
          ]
        );
      }
    }

    await createAuditLog({
      tenantId,
      actorId,
      action: "CREATED",
      entityType: "WORKFLOW",
      entityId: workflowId,
      metadata: { name, stateCount: states.length, transitionCount: transitions?.length ?? 0 },
    }, client);

    logger.info({ workflowId, tenantId }, "Workflow created");
    return { message: "Workflow created", workflowId };
  });
}

export async function addToWorkflow(
  workflowId: string,
  input: {
    states?: { name: string; isFinal?: boolean }[];
    transitions?: {
      fromState: string;
      toState: string;
      requiresApproval: boolean;
      approvalStrategy: string;
      requiredApprovals?: number;
      requiredRole?: string;
    }[];
  },
  tenantId: string
) {
  const { states = [], transitions = [] } = input;

  if (states.length === 0 && transitions.length === 0) {
    throw new ValidationError("Provide at least one state or transition to add");
  }

  return withTransaction(async (client) => {
    const wfCheck = await client.query(
      `SELECT id FROM workflows WHERE id = $1 AND tenant_id = $2`,
      [workflowId, tenantId]
    );
    if ((wfCheck.rowCount ?? 0) === 0) {
      throw new NotFoundError("Workflow", workflowId);
    }

    const existingStates = await client.query(
      `SELECT id, name FROM workflow_states WHERE workflow_id = $1`,
      [workflowId]
    );
    const stateMap: Record<string, string> = {};
    for (const row of existingStates.rows) {
      stateMap[row.name] = row.id;
    }

    for (const state of states) {
      if (stateMap[state.name]) continue;
      const r = await client.query(
        `INSERT INTO workflow_states (workflow_id, name, is_initial, is_final)
         VALUES ($1, $2, false, $3) RETURNING id`,
        [workflowId, state.name, state.isFinal || false]
      );
      stateMap[state.name] = r.rows[0].id;
    }

    for (const t of transitions) {
      if (!stateMap[t.fromState] || !stateMap[t.toState]) {
        throw new ValidationError(`Unknown state in transition: "${t.fromState}" → "${t.toState}"`);
      }
      await client.query(
        `INSERT INTO workflow_transitions
         (workflow_id, from_state_id, to_state_id,
          requires_approval, approval_strategy, required_approvals, required_role)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT DO NOTHING`,
        [
          workflowId,
          stateMap[t.fromState],
          stateMap[t.toState],
          t.requiresApproval,
          t.approvalStrategy,
          t.requiredApprovals || 1,
          t.requiredRole || null,
        ]
      );
    }

    await client.query(
      `UPDATE workflows SET version = version + 1 WHERE id = $1`,
      [workflowId]
    );

    return { message: "Workflow updated", addedStates: states.length, addedTransitions: transitions.length };
  });
}

export async function deactivateWorkflow(workflowId: string, tenantId: string) {
  const check = await pool.query(
    `SELECT id FROM workflows WHERE id = $1 AND tenant_id = $2`,
    [workflowId, tenantId]
  );

  if ((check.rowCount ?? 0) === 0) {
    throw new NotFoundError("Workflow", workflowId);
  }

  await pool.query(
    `UPDATE workflows SET is_active = false WHERE id = $1`,
    [workflowId]
  );

  logger.info({ workflowId }, "Workflow deactivated");
  return { message: "Workflow deactivated. Existing items are unaffected." };
}

export async function listWorkflows(tenantId: string, pagination: PaginationParams) {
  const { limit, offset } = paginationToSql(pagination);

  const [rows, count] = await Promise.all([
    pool.query(
      `SELECT id, name, version, is_active, created_at
       FROM workflows
       WHERE tenant_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [tenantId, limit, offset]
    ),
    pool.query(
      `SELECT COUNT(*) FROM workflows WHERE tenant_id = $1`,
      [tenantId]
    ),
  ]);

  return buildPaginatedResult(rows.rows, parseInt(count.rows[0].count), pagination);
}

export async function getWorkflowDetails(workflowId: string, tenantId: string) {
  const workflow = await pool.query(
    `SELECT * FROM workflows
     WHERE id = $1 AND tenant_id = $2`,
    [workflowId, tenantId]
  );

  if (workflow.rowCount === 0) {
    throw new NotFoundError("Workflow", workflowId);
  }

  const [states, transitions] = await Promise.all([
    pool.query(
      `SELECT * FROM workflow_states WHERE workflow_id = $1`,
      [workflowId]
    ),
    pool.query(
      `SELECT * FROM workflow_transitions WHERE workflow_id = $1`,
      [workflowId]
    ),
  ]);

  return {
    workflow: workflow.rows[0],
    states: states.rows,
    transitions: transitions.rows,
  };
}
