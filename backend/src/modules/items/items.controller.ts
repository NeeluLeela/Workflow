import { Response } from "express";
import { AuthRequest } from "../../types/express";
import { createItemSchema, transitionSchema, batchTransitionSchema } from "./items.schema";
import { paginationSchema } from "../../utils/pagination";
import * as itemsService from "./items.service";

export const listItems = async (req: AuthRequest, res: Response) => {
  const pagination = paginationSchema.parse(req.query);
  const result = await itemsService.listItems(req.tenantId!, pagination);
  return res.json(result);
};

export const getItemDetails = async (req: AuthRequest, res: Response) => {
  const item = await itemsService.getItemDetails(req.params.id as string, req.tenantId!);
  return res.json(item);
};

export const getItemAudit = async (req: AuthRequest, res: Response) => {
  const audit = await itemsService.getItemAudit(req.params.id as string, req.tenantId!);
  return res.json(audit);
};

export const getTenantAudit = async (req: AuthRequest, res: Response) => {
  const pagination = paginationSchema.parse(req.query);
  const filters = {
    actionType: req.query.actionType as string | undefined,
    itemId: req.query.itemId as string | undefined,
  };
  const result = await itemsService.getTenantAudit(req.tenantId!, filters, pagination);
  return res.json(result);
};

export const getItemTransitions = async (req: AuthRequest, res: Response) => {
  const transitions = await itemsService.getItemTransitions(req.params.id as string, req.tenantId!);
  return res.json(transitions);
};

export const createItem = async (req: AuthRequest, res: Response) => {
  const { workflowId, title } = createItemSchema.parse(req.body);
  const item = await itemsService.createItem(req.tenantId!, workflowId, title, req.user!.id);
  return res.status(201).json(item);
};

export const transitionItem = async (req: AuthRequest, res: Response) => {
  const { transitionId, version, idempotencyKey } = transitionSchema.parse(req.body);
  const result = await itemsService.transitionItem(
    req.params.id as string,
    transitionId,
    version,
    req.tenantId!,
    req.user!.id,
    req.tenantRole!,
    idempotencyKey
  );
  return res.json(result);
};

export const batchTransition = async (req: AuthRequest, res: Response) => {
  const { items, idempotencyKey } = batchTransitionSchema.parse(req.body);
  const result = await itemsService.batchTransition(
    items,
    req.tenantId!,
    req.user!.id,
    req.tenantRole!,
    idempotencyKey
  );
  return res.json(result);
};
