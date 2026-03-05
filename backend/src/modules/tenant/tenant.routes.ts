import { Router } from "express";
import { authenticate } from "../../middleware/auth.middleware";
import { attachTenant } from "../../middleware/tenant.middleware";
import { requireRole } from "../../middleware/role.middleware";
import {
  createTenant,
  getMyTenants,
  listTenantMembers,
  addTenantMember,
  removeTenantMember,
} from "./tenant.controller";

const router = Router();

router.post("/", authenticate, createTenant);
router.get("/", authenticate, getMyTenants);
router.get("/:id/members", authenticate, attachTenant, listTenantMembers);
router.post("/:id/members", authenticate, attachTenant, requireRole(["ADMIN"]), addTenantMember);
router.delete("/:id/members/:userId", authenticate, attachTenant, requireRole(["ADMIN"]), removeTenantMember);

export default router;