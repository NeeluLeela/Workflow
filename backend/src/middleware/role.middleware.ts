import { Response, NextFunction } from "express";
import { AuthRequest } from "../types/express";
import { ForbiddenError } from "../utils/errors";

export const requireRole = (allowedRoles: string[]) => {
  return (req: AuthRequest, _res: Response, next: NextFunction) => {
    const role = req.tenantRole;

    if (!role) {
      throw new ForbiddenError("Not a tenant member");
    }

    if (!allowedRoles.includes(role)) {
      throw new ForbiddenError("Insufficient permissions");
    }

    next();
  };
};
