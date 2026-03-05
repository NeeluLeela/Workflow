import { Response } from "express";
import { AuthRequest } from "../../types/express";
import { createTenantSchema, addMemberSchema } from "./tenant.schema";
import * as tenantService from "./tenant.service";

export const createTenant = async (req: AuthRequest, res: Response) => {
  const { name } = createTenantSchema.parse(req.body);
  const tenant = await tenantService.createTenant(name, req.user!.id);
  return res.status(201).json(tenant);
};

export const getMyTenants = async (req: AuthRequest, res: Response) => {
  const tenants = await tenantService.getMyTenants(req.user!.id);
  return res.json(tenants);
};

export const listTenantMembers = async (req: AuthRequest, res: Response) => {
  const members = await tenantService.listTenantMembers(req.tenantId!);
  return res.json(members);
};

export const addTenantMember = async (req: AuthRequest, res: Response) => {
  const { email, role } = addMemberSchema.parse(req.body);
  const result = await tenantService.addTenantMember(req.tenantId!, email, role, req.user!.id);
  return res.status(201).json(result);
};

export const removeTenantMember = async (req: AuthRequest, res: Response) => {
  const result = await tenantService.removeTenantMember(req.tenantId!, req.params.userId as string, req.user!.id);
  return res.json(result);
};