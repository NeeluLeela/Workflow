import { Response, NextFunction } from "express";
import { pool } from "../db/pool";
import { AuthRequest } from "../types/express";
import { UnauthorizedError, ForbiddenError, ValidationError } from "../utils/errors";

export const attachTenant = async (
  req: AuthRequest,
  _res: Response,
  next: NextFunction
) => {
  const tenantId = req.headers["x-tenant-id"] as string;

  if (!tenantId) {
    throw new ValidationError("X-Tenant-Id header is required");
  }

  if (!req.user) {
    throw new UnauthorizedError();
  }

  const result = await pool.query(
    `SELECT role FROM tenant_members
     WHERE user_id = $1 AND tenant_id = $2`,
    [req.user.id, tenantId]
  );

  if (result.rowCount === 0) {
    throw new ForbiddenError("Access denied for this tenant");
  }

  req.tenantId = tenantId;
  req.tenantRole = result.rows[0].role;

  next();
};