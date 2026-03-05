import { z } from "zod";

export const createSlaRuleSchema = z.object({
  workflowId: z.string().uuid(),
  stateId: z.string().uuid(),
  deadlineHours: z.number().int().positive(),
  escalationRole: z.string().transform((v) => v.toUpperCase()).pipe(z.enum(["ADMIN", "APPROVER"])).default("ADMIN"),
});
