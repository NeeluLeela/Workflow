import { Response } from "express";
import { AuthRequest } from "../../types/express";
import { approvalDecisionSchema, delegateApprovalSchema, batchApprovalSchema } from "./items.schema";
import { paginationSchema } from "../../utils/pagination";
import * as approvalService from "./approval.service";

export const decideApproval = async (req: AuthRequest, res: Response) => {
  const { decision } = approvalDecisionSchema.parse(req.body);
  const result = await approvalService.decideApproval(
    req.params.itemId as string,
    decision,
    req.tenantId!,
    req.user!.id
  );
  return res.json(result);
};

export const listPendingApprovals = async (req: AuthRequest, res: Response) => {
  const pagination = paginationSchema.parse(req.query);
  const result = await approvalService.listPendingApprovals(req.user!.id, req.tenantId!, pagination);
  return res.json(result);
};

export const delegateApproval = async (req: AuthRequest, res: Response) => {
  const { delegateToUserId } = delegateApprovalSchema.parse(req.body);
  const result = await approvalService.delegateApproval(
    req.params.approvalId as string,
    delegateToUserId,
    req.user!.id,
    req.tenantId!
  );
  return res.json(result);
};

export const batchDecideApproval = async (req: AuthRequest, res: Response) => {
  const { decision, itemIds } = batchApprovalSchema.parse(req.body);
  const result = await approvalService.batchDecideApproval(
    itemIds,
    decision,
    req.tenantId!,
    req.user!.id
  );
  return res.json(result);
};
