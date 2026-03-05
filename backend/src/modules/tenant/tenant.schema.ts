import { z } from "zod";

export const createTenantSchema = z.object({
  name: z.string().min(3),
});

export const addMemberSchema = z.object({
  email: z.string().email(),
  role: z.string().transform((v) => v.toUpperCase()).pipe(z.enum(["ADMIN", "USER", "APPROVER"])),
});