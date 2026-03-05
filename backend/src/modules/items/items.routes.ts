import { Router } from "express";
import { authenticate } from "../../middleware/auth.middleware";
import { attachTenant } from "../../middleware/tenant.middleware";
import {
  createItem,
  transitionItem,
  batchTransition,
  listItems,
  getItemDetails,
  getItemAudit,
  getItemTransitions,
  getTenantAudit,
} from "./items.controller";
import { decideApproval } from "./approval.controller";

const router = Router();

router.get("/audit", authenticate, attachTenant, getTenantAudit);

router.get("/", authenticate, attachTenant, listItems);

router.post("/", authenticate, attachTenant, createItem);

router.post("/batch-transition", authenticate, attachTenant, batchTransition);

router.get("/:id", authenticate, attachTenant, getItemDetails);

router.get("/:id/transitions", authenticate, attachTenant, getItemTransitions);

router.get("/:id/audit", authenticate, attachTenant, getItemAudit);

router.post("/:id/transition", authenticate, attachTenant, transitionItem);

router.post("/:itemId/approve", authenticate, attachTenant, decideApproval);

export default router;
