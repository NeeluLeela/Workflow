import { z } from "zod";

export const createItemSchema = z.object({
  workflowId: z.string().uuid(),
  title: z.string().trim().min(1),
});

export const transitionSchema = z.object({
  transitionId: z.string().uuid(),
  version: z.number().int().positive(),
  idempotencyKey: z.string().uuid().optional(),
});

export const approvalDecisionSchema = z.object({
  decision: z.string().transform((v) => v.toUpperCase()).pipe(z.enum(["APPROVED", "REJECTED"])),
});

export const delegateApprovalSchema = z.object({
  delegateToUserId: z.string().uuid(),
});

export const batchTransitionSchema = z.object({
  items: z.array(z.object({
    itemId: z.string().uuid(),
    transitionId: z.string().uuid(),
    version: z.number().int().positive(),
  })).min(1).max(50),
  idempotencyKey: z.string().uuid().optional(),
});

export const batchApprovalSchema = z.object({
  decision: z.string().transform((v) => v.toUpperCase()).pipe(z.enum(["APPROVED", "REJECTED"])),
  itemIds: z.array(z.string().uuid()).min(1).max(50),
});
