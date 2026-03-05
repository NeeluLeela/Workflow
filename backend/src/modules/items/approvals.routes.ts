import { Router } from "express";
import { authenticate } from "../../middleware/auth.middleware";
import { attachTenant } from "../../middleware/tenant.middleware";
import { listPendingApprovals, delegateApproval, batchDecideApproval } from "./approval.controller";

const router = Router();

router.get("/pending", authenticate, attachTenant, listPendingApprovals);

router.post("/batch-decide", authenticate, attachTenant, batchDecideApproval);

router.post("/:approvalId/delegate", authenticate, attachTenant, delegateApproval);

export default router;
