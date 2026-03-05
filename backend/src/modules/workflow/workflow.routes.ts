import { Router } from "express";
import { authenticate } from "../../middleware/auth.middleware";
import { attachTenant } from "../../middleware/tenant.middleware";
import { requireRole } from "../../middleware/role.middleware";
import {
  createWorkflow,
  listWorkflows,
  getWorkflowDetails,
  deactivateWorkflow,
  addToWorkflow,
} from "./workflow.controller";

const router = Router();

router.post(
  "/",
  authenticate,
  attachTenant,
  requireRole(["ADMIN"]),
  createWorkflow
);

router.get("/", authenticate, attachTenant, listWorkflows);

router.get("/:id", authenticate, attachTenant, getWorkflowDetails);

router.patch(
  "/:id",
  authenticate,
  attachTenant,
  requireRole(["ADMIN"]),
  addToWorkflow
);

router.patch(
  "/:id/deactivate",
  authenticate,
  attachTenant,
  requireRole(["ADMIN"]),
  deactivateWorkflow
);

export default router;