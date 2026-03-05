import { Router } from "express";
import { authenticate } from "../../middleware/auth.middleware";
import { attachTenant } from "../../middleware/tenant.middleware";
import { requireRole } from "../../middleware/role.middleware";
import {
  createSlaRule,
  listSlaRules,
  deleteSlaRule,
  listSlaBreaches,
} from "./sla.controller";

const router = Router();

router.get("/rules", authenticate, attachTenant, listSlaRules);
router.post("/rules", authenticate, attachTenant, requireRole(["ADMIN"]), createSlaRule);
router.delete("/rules/:id", authenticate, attachTenant, requireRole(["ADMIN"]), deleteSlaRule);
router.get("/breaches", authenticate, attachTenant, listSlaBreaches);

export default router;
