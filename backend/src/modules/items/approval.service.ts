import { pool, withTransaction } from "../../db/pool";
import { NotFoundError, ValidationError, ForbiddenError, OptimisticLockError } from "../../utils/errors";
import { createAuditLog } from "../audit/audit.service";
import { logger } from "../../utils/logger";
import { PaginationParams, paginationToSql, buildPaginatedResult } from "../../utils/pagination";

export async function decideApproval(
  itemId: string,
  decision: "APPROVED" | "REJECTED",
  tenantId: string,
  userId: string
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

    const approvalsResult = await client.query(
      `SELECT a.*
       FROM approvals a
       JOIN items i ON i.id = a.item_id
       WHERE a.item_id = $1 AND i.tenant_id = $2
       FOR UPDATE`,
      [itemId, tenantId]
    );

    if ((approvalsResult.rowCount ?? 0) === 0) {
      throw new NotFoundError("No active approvals found");
    }

    const userApproval = approvalsResult.rows.find(
      (a) => a.approver_id === userId && a.status === "PENDING"
    );

    if (!userApproval) {
      const hasAny = approvalsResult.rows.some((a) => a.approver_id === userId);
      if (hasAny) {
        throw new ValidationError("You have already decided on all pending approvals for this item");
      }
      throw new ForbiddenError("You are not an approver for this item");
    }

    const transitionId = userApproval.transition_id;

    const transitionResult = await client.query(
      `SELECT * FROM workflow_transitions WHERE id = $1`,
      [transitionId]
    );

    if ((transitionResult.rowCount ?? 0) === 0) {
      throw new NotFoundError("Transition definition");
    }

    const transition = transitionResult.rows[0];

    await client.query(
      `UPDATE approvals SET status = $1, decided_at = now() WHERE id = $2`,
      [decision, userApproval.id]
    );

    if (decision === "REJECTED") {
      await client.query(
        `UPDATE approvals
         SET status = 'REJECTED', decided_at = now()
         WHERE item_id = $1 AND transition_id = $2 AND status = 'PENDING'`,
        [itemId, transitionId]
      );

      const item = itemResult.rows[0];
      await createAuditLog({
        tenantId,
        actorId: userId,
        action: "REJECTED",
        entityType: "ITEM",
        entityId: itemId,
        metadata: { transitionId },
        beforeState: { state_id: item.current_state_id },
        afterState: { state_id: item.current_state_id, decision: "REJECTED" },
      }, client);

      logger.info({ itemId, userId }, "Approval rejected");
      return { message: "Approval rejected. Item remains in current state." };
    }

    const updatedApprovals = await client.query(
      `SELECT a.*
       FROM approvals a
       JOIN items i ON i.id = a.item_id
       WHERE a.item_id = $1 AND a.transition_id = $2 AND i.tenant_id = $3`,
      [itemId, transitionId, tenantId]
    );

    const approvedCount = updatedApprovals.rows.filter(
      (a) => a.status === "APPROVED"
    ).length;
    const totalApprovals = updatedApprovals.rows.length;

    let shouldMove = false;

    if (transition.approval_strategy === "SINGLE") {
      shouldMove = approvedCount >= 1;
    } else if (transition.approval_strategy === "ALL") {
      shouldMove = approvedCount === totalApprovals;
    } else if (transition.approval_strategy === "QUORUM") {
      shouldMove = approvedCount >= transition.required_approvals;
    }

    if (shouldMove) {
      const item = itemResult.rows[0];
      const updateResult = await client.query(
        `UPDATE items
         SET current_state_id = $1, version = version + 1
         WHERE id = $2 AND version = $3
         RETURNING *`,
        [transition.to_state_id, itemId, item.version]
      );

      if ((updateResult.rowCount ?? 0) === 0) {
        throw new OptimisticLockError();
      }

      await client.query(
        `UPDATE approvals
         SET status = 'APPROVED', decided_at = now()
         WHERE item_id = $1 AND transition_id = $2 AND status = 'PENDING'`,
        [itemId, transitionId]
      );

      await createAuditLog({
        tenantId,
        actorId: userId,
        action: "STATE_CHANGED",
        entityType: "ITEM",
        entityId: itemId,
        metadata: { transitionId },
        beforeState: { state_id: item.current_state_id },
        afterState: { state_id: transition.to_state_id },
      }, client);

      logger.info({ itemId, transitionId }, "Approval completed, state changed");
    } else {
      await createAuditLog({
        tenantId,
        actorId: userId,
        action: "PARTIAL_APPROVAL",
        entityType: "ITEM",
        entityId: itemId,
        metadata: { transitionId, approvedCount, totalApprovals },
      }, client);
    }

    return {
      message: shouldMove
        ? "Approved and state transitioned"
        : "Approved. Waiting for more approvals.",
    };
  });
}

export async function listPendingApprovals(
  userId: string,
  tenantId: string,
  pagination: PaginationParams
) {
  const { limit, offset } = paginationToSql(pagination);

  const [rows, count] = await Promise.all([
    pool.query(
      `SELECT
        a.id, a.item_id, a.status, a.transition_id,
        i.title, w.name AS workflow_name, s.name AS current_state
      FROM approvals a
      JOIN items i ON i.id = a.item_id
      JOIN workflows w ON w.id = i.workflow_id
      JOIN workflow_states s ON s.id = i.current_state_id
      WHERE a.approver_id = $1
      AND a.status = 'PENDING'
      AND i.tenant_id = $2
      ORDER BY i.created_at DESC
      LIMIT $3 OFFSET $4`,
      [userId, tenantId, limit, offset]
    ),
    pool.query(
      `SELECT COUNT(*)
       FROM approvals a
       JOIN items i ON i.id = a.item_id
       WHERE a.approver_id = $1 AND a.status = 'PENDING' AND i.tenant_id = $2`,
      [userId, tenantId]
    ),
  ]);

  return buildPaginatedResult(rows.rows, parseInt(count.rows[0].count), pagination);
}

export async function batchDecideApproval(
  itemIds: string[],
  decision: "APPROVED" | "REJECTED",
  tenantId: string,
  userId: string
) {
  const results: Array<{ itemId: string; status: "success" | "error"; message: string }> = [];

  for (const itemId of itemIds) {
    try {
      const result = await decideApproval(itemId, decision, tenantId, userId);
      results.push({ itemId, status: "success", message: result.message });
    } catch (err: any) {
      results.push({
        itemId,
        status: "error",
        message: err.message || "Decision failed",
      });
    }
  }

  return { results };
}

export async function delegateApproval(
  approvalId: string,
  delegateToUserId: string,
  userId: string,
  tenantId: string
) {
  return withTransaction(async (client) => {
    const approvalResult = await client.query(
      `SELECT a.*, i.tenant_id
       FROM approvals a
       JOIN items i ON i.id = a.item_id
       WHERE a.id = $1 AND a.approver_id = $2 AND a.status = 'PENDING' AND i.tenant_id = $3
       FOR UPDATE`,
      [approvalId, userId, tenantId]
    );

    if ((approvalResult.rowCount ?? 0) === 0) {
      throw new NotFoundError("Approval not found or not pending");
    }

    const memberCheck = await client.query(
      `SELECT 1 FROM tenant_members WHERE user_id = $1 AND tenant_id = $2`,
      [delegateToUserId, tenantId]
    );

    if ((memberCheck.rowCount ?? 0) === 0) {
      throw new ValidationError("Delegate user is not a member of this tenant");
    }

    await client.query(
      `UPDATE approvals SET approver_id = $1, delegated_from = $2 WHERE id = $3`,
      [delegateToUserId, userId, approvalId]
    );

    const approval = approvalResult.rows[0];

    await createAuditLog({
      tenantId,
      actorId: userId,
      action: "DELEGATED",
      entityType: "ITEM",
      entityId: approval.item_id,
      metadata: { delegateToUserId, approvalId },
    }, client);

    logger.info({ approvalId, delegateToUserId }, "Approval delegated");
    return { message: "Approval delegated successfully" };
  });
}
