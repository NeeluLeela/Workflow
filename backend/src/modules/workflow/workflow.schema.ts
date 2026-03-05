import { z } from "zod";

const transitionSchema = z.object({
  fromState: z.string().min(1),
  toState: z.string().min(1),
  requiresApproval: z.boolean(),
  approvalStrategy: z.string().transform((v) => v.toUpperCase()).pipe(z.enum(["NONE", "SINGLE", "ALL", "QUORUM"])),
  requiredApprovals: z.number().int().positive().optional(),
  requiredRole: z.string().min(1).transform((v) => v.toUpperCase()).optional(),
}).superRefine((t, ctx) => {
  if (t.requiresApproval && t.approvalStrategy === "NONE") {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "approvalStrategy cannot be NONE when requiresApproval is true",
      path: ["approvalStrategy"],
    });
  }
  if (t.requiresApproval && !t.requiredRole) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "requiredRole is required when requiresApproval is true",
      path: ["requiredRole"],
    });
  }
  if (t.approvalStrategy === "QUORUM" && !t.requiredApprovals) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "requiredApprovals must be set for QUORUM strategy",
      path: ["requiredApprovals"],
    });
  }
  if (t.fromState === t.toState) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "fromState and toState must be different",
      path: ["toState"],
    });
  }
});

export const createWorkflowSchema = z.object({
  name: z.string().min(3),
  states: z.array(
    z.object({
      name: z.string().min(2),
      isInitial: z.boolean().optional(),
      isFinal: z.boolean().optional(),
    })
  ).min(2),
  transitions: z.array(transitionSchema).optional(),
}).superRefine((wf, ctx) => {
  const names = wf.states.map(s => s.name);
  const unique = new Set(names);
  if (unique.size !== names.length) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "State names must be unique within a workflow",
      path: ["states"],
    });
  }
  const finalStates = wf.states.filter(s => s.isFinal);
  if (finalStates.length < 1) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "At least one final state is required",
      path: ["states"],
    });
  }
});

export const addToWorkflowSchema = z.object({
  states: z.array(
    z.object({
      name: z.string().min(2),
      isFinal: z.boolean().optional(),
    })
  ).optional(),
  transitions: z.array(transitionSchema).optional(),
});