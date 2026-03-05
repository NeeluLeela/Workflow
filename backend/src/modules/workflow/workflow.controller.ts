import { Response } from "express";
import { AuthRequest } from "../../types/express";
import { createWorkflowSchema, addToWorkflowSchema } from "./workflow.schema";
import { paginationSchema } from "../../utils/pagination";
import * as workflowService from "./workflow.service";

export const createWorkflow = async (req: AuthRequest, res: Response) => {
  const data = createWorkflowSchema.parse(req.body);
  const result = await workflowService.createWorkflow(data, req.tenantId!, req.user!.id);
  return res.status(201).json(result);
};

export const addToWorkflow = async (req: AuthRequest, res: Response) => {
  const data = addToWorkflowSchema.parse(req.body);
  const result = await workflowService.addToWorkflow(req.params.id as string, data, req.tenantId!);
  return res.json(result);
};

export const deactivateWorkflow = async (req: AuthRequest, res: Response) => {
  const result = await workflowService.deactivateWorkflow(req.params.id as string, req.tenantId!);
  return res.json(result);
};

export const listWorkflows = async (req: AuthRequest, res: Response) => {
  const pagination = paginationSchema.parse(req.query);
  const result = await workflowService.listWorkflows(req.tenantId!, pagination);
  return res.json(result);
};

export const getWorkflowDetails = async (req: AuthRequest, res: Response) => {
  const result = await workflowService.getWorkflowDetails(req.params.id as string, req.tenantId!);
  return res.json(result);
};