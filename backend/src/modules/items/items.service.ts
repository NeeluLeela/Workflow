import { pool, withTransaction } from "../../db/pool";
import {
  NotFoundError,
  ValidationError,
  ForbiddenError,
  OptimisticLockError,
} from "../../utils/errors";
import { createAuditLog } from "../audit/audit.service";
import { logger } from "../../utils/logger";
import { PaginationParams, paginationToSql, buildPaginatedResult } from "../../utils/pagination";

export async function listItems(tenantId: string, pagination: PaginationParams) {
  const { limit, offset } = paginationToSql(pagination);

  const [rows, count] = await Promise.all([
    pool.query(
      `SELECT
        i.id, i.title, i.version, i.created_at,
        w.name AS workflow_name,
        s.name AS current_state
      FROM items i
      JOIN workflows w ON w.id = i.workflow_id
      JOIN workflow_states s ON s.id = i.current_state_id
      WHERE i.tenant_id = $1
      ORDER BY i.created_at DESC
      LIMIT $2 OFFSET $3`,
      [tenantId, limit, offset]
    ),
    pool.query(
      `SELECT COUNT(*) FROM items WHERE tenant_id = $1`,
      [tenantId]
    ),
  ]);

  return buildPaginatedResult(rows.rows, parseInt(count.rows[0].count), pagination);
}

export async function getItemDetails(itemId: string, tenantId: string) {
  const result = await pool.query(
    `SELECT
      i.*, w.name AS workflow_name, s.name AS current_state
    FROM items i
    JOIN workflows w ON w.id = i.workflow_id
    JOIN workflow_states s ON s.id = i.current_state_id
    WHERE i.id = $1 AND i.tenant_id = $2`,
    [itemId, tenantId]
  );

  if ((result.rowCount ?? 0) === 0) {
    throw new NotFoundError("Item", itemId);
  }

  return result.rows[0];
}

export async function getItemTransitions(itemId: string, tenantId: string) {
  const itemResult = await pool.query(
    `SELECT current_state_id FROM items WHERE id = $1 AND tenant_id = $2`,
    [itemId, tenantId]
  );

  if ((itemResult.rowCount ?? 0) === 0) {
    throw new NotFoundError("Item", itemId);
  }

  const currentStateId = itemResult.rows[0].current_state_id;

  const result = await pool.query(
    `SELECT
      wt.id, ws_to.name AS to_state,
      wt.requires_approval, wt.approval_strategy
    FROM workflow_transitions wt
    JOIN workflow_states ws_to ON ws_to.id = wt.to_state_id
    WHERE wt.from_state_id = $1`,
    [currentStateId]
  );

  return result.rows;
}

export async function createItem(
  tenantId: string,
  workflowId: string,
  title: string,
  actorId: string
) {
  return withTransaction(async (client) => {
    const wf = await client.query(
      `SELECT id, is_active FROM workflows
       WHERE id = $1 AND tenant_id = $2`,
      [workflowId, tenantId]
    );

    if ((wf.rowCount ?? 0) === 0) {
      throw new NotFoundError("Workflow", workflowId);
    }

    if (!wf.rows[0].is_active) {
      throw new ValidationError(
        "This workflow has been deactivated and cannot accept new items"
      );
    }

    const state = await client.query(
      `SELECT id FROM workflow_states
       WHERE workflow_id = $1 AND is_initial = true`,
      [workflowId]
    );

    if ((state.rowCount ?? 0) === 0) {
      throw new ValidationError("No initial state defined");
    }

    const initialStateId = state.rows[0].id;

    const item = await client.query(
      `INSERT INTO items
       (tenant_id, workflow_id, current_state_id, created_by, title)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [tenantId, workflowId, initialStateId, actorId, title]
    );

    await createAuditLog({
      tenantId,
      actorId,
      action: "CREATED",
      entityType: "ITEM",
      entityId: item.rows[0].id,
    }, client);

    logger.info({ itemId: item.rows[0].id, tenantId }, "Item created");
    return item.rows[0];
  });
}

export async function transitionItem(
  itemId: string,
  transitionId: string,
  version: number,
  tenantId: string,
  actorId: string,
  tenantRole: string,
  idempotencyKey?: string
) {
  return withTransaction(async (client) => {
    const itemResult = await client.query(
      `SELECT * FROM items
       WHERE id = $1 AND tenant_id = $2
       FOR UPDATE`,
      [itemId, tenantId]
    );

    if ((itemResult.rowCount ?? 0) === 0) {
      throw new NotFoundError("Item", itemId);
    }

    const item = itemResult.rows[0];

    const transitionResult = await client.query(
      `SELECT * FROM workflow_transitions
       WHERE id = $1 AND workflow_id = $2`,
      [transitionId, item.workflow_id]
    );

    if ((transitionResult.rowCount ?? 0) === 0) {
      throw new ValidationError("Invalid transition");
    }

    const transition = transitionResult.rows[0];

    if (transition.from_state_id !== item.current_state_id) {
      throw new ValidationError("Transition not allowed from current state");
    }

    if (transition.required_role && tenantRole !== "ADMIN") {
      if (tenantRole !== transition.required_role) {
        throw new ForbiddenError(
          `Your role '${tenantRole}' is not allowed for this transition (requires '${transition.required_role}')`
        );
      }
    }

    const pendingApprovals = await client.query(
      `SELECT 1 FROM approvals WHERE item_id = $1 AND status = 'PENDING'`,
      [itemId]
    );
    if ((pendingApprovals.rowCount ?? 0) > 0) {
      throw new ValidationError("Item has pending approvals. Resolve them before triggering a new transition.");
    }

    if (transition.requires_approval) {
      if (!transition.required_role) {
        throw new ValidationError("Approval transition must define required_role");
      }

      if (idempotencyKey) {
        const existing = await client.query(
          `SELECT id FROM approvals WHERE item_id = $1 AND idempotency_key = $2`,
          [itemId, idempotencyKey]
        );
        if ((existing.rowCount ?? 0) > 0) {
          return { message: "Approval process already initiated", idempotent: true };
        }
      }

      const approvers = await client.query(
        `SELECT user_id FROM tenant_members
         WHERE tenant_id = $1 AND role = $2`,
        [tenantId, transition.required_role]
      );

      if ((approvers.rowCount ?? 0) === 0) {
        throw new ValidationError("No eligible approvers found for this role");
      }

      for (const row of approvers.rows) {
        await client.query(
          `INSERT INTO approvals
           (item_id, approver_id, transition_id, idempotency_key)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (item_id, approver_id, transition_id) DO NOTHING`,
          [itemId, row.user_id, transitionId, idempotencyKey || null]
        );
      }

      await createAuditLog({
        tenantId,
        actorId,
        action: "APPROVAL_REQUESTED",
        entityType: "ITEM",
        entityId: itemId,
        metadata: { transitionId },
      }, client);

      return { message: "Approval process initiated" };
    }

    const updateResult = await client.query(
      `UPDATE items
       SET current_state_id = $1, version = version + 1
       WHERE id = $2 AND version = $3
       RETURNING *`,
      [transition.to_state_id, itemId, version]
    );

    if ((updateResult.rowCount ?? 0) === 0) {
      throw new OptimisticLockError();
    }

    await createAuditLog({
      tenantId,
      actorId,
      action: "STATE_CHANGED",
      entityType: "ITEM",
      entityId: itemId,
      metadata: { transitionId },
      beforeState: { state_id: item.current_state_id },
      afterState: { state_id: transition.to_state_id },
    }, client);

    logger.info({ itemId, transitionId }, "Item state changed");
    return { message: "State changed successfully" };
  });
}

export async function batchTransition(
  items: Array<{ itemId: string; transitionId: string; version: number }>,
  tenantId: string,
  actorId: string,
  tenantRole: string,
  idempotencyKey?: string
) {
  const results: Array<{ itemId: string; status: "success" | "error"; message: string }> = [];

  for (const entry of items) {
    try {
      const result = await transitionItem(
        entry.itemId,
        entry.transitionId,
        entry.version,
        tenantId,
        actorId,
        tenantRole,
        idempotencyKey
      );
      results.push({ itemId: entry.itemId, status: "success", message: result.message });
    } catch (err: any) {
      results.push({
        itemId: entry.itemId,
        status: "error",
        message: err.message || "Transition failed",
      });
    }
  }

  return { results };
}

export async function getItemAudit(itemId: string, tenantId: string) {
  const itemCheck = await pool.query(
    `SELECT 1 FROM items WHERE id = $1 AND tenant_id = $2`,
    [itemId, tenantId]
  );

  if ((itemCheck.rowCount ?? 0) === 0) {
    throw new NotFoundError("Item", itemId);
  }

  const result = await pool.query(
    `SELECT al.*, u.email AS performed_by_email
    FROM audit_logs al
    LEFT JOIN users u ON u.id = al.performed_by
    WHERE al.entity_id = $1 AND al.tenant_id = $2
    ORDER BY al.created_at ASC`,
    [itemId, tenantId]
  );

  return result.rows;
}

export async function getTenantAudit(
  tenantId: string,
  filters: { actionType?: string; itemId?: string },
  pagination: PaginationParams
) {
  const { limit, offset } = paginationToSql(pagination);

  const conditions: string[] = ["al.tenant_id = $1"];
  const params: unknown[] = [tenantId];
  let idx = 2;

  if (filters.actionType) {
    conditions.push(`al.action_type = $${idx++}`);
    params.push(filters.actionType);
  }
  if (filters.itemId) {
    conditions.push(`al.entity_id = $${idx++}`);
    params.push(filters.itemId);
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
      [...params, limit, offset]
    ),
    pool.query(
      `SELECT COUNT(*) FROM audit_logs al WHERE ${where}`,
      params
    ),
  ]);

  return buildPaginatedResult(rows.rows, parseInt(count.rows[0].count), pagination);
}
