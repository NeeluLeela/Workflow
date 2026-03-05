import { Request, Response } from "express";
import { registerSchema, loginSchema } from "./auth.schema";
import { AuthRequest } from "../../types/express";
import * as authService from "./auth.service";

export const register = async (req: Request, res: Response) => {
  const { email, password } = registerSchema.parse(req.body);
  const user = await authService.registerUser(email, password);
  return res.status(201).json(user);
};

export const login = async (req: Request, res: Response) => {
  const { email, password } = loginSchema.parse(req.body);
  const result = await authService.loginUser(email, password);
  return res.json(result);
};

export const getCurrentUser = async (req: AuthRequest, res: Response) => {
  const user = await authService.getCurrentUser(req.user!.id);
  return res.json({ user });
};
