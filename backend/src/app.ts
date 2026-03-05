import express from "express";
import helmet from "helmet";
import compression from "compression";
import cors from "cors";
import pinoHttp from "pino-http";
import crypto from "crypto";
import rateLimit from "express-rate-limit";
import authRoutes from "./modules/auth/auth.routes";
import tenantRoutes from "./modules/tenant/tenant.routes";
import workflowRoutes from "./modules/workflow/workflow.routes";
import itemRoutes from "./modules/items/items.routes";
import approvalsRoutes from "./modules/items/approvals.routes";
import slaRoutes from "./modules/sla/sla.routes";
import { logger } from "./utils/logger";
import { notFoundMiddleware, errorMiddleware } from "./middleware/error-handlers";
import { pool } from "./db/pool";

export const app = express();

const isProduction = process.env.NODE_ENV === "production";

app.set("trust proxy", 1);

app.use(helmet());

app.use(compression());

app.use((req, _res, next) => {
  (req as any).id = req.headers["x-request-id"] || crypto.randomUUID();
  next();
});

const allowedOrigins = (process.env.CORS_ORIGIN || "http://localhost:5173")
  .split(",")
  .map((o) => o.trim());

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  })
);

app.use(express.json({ limit: "1mb" }));

app.use(
  pinoHttp({
    logger,
    quietReqLogger: isProduction,
    genReqId: (req) => (req as any).id,
  })
);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "TOO_MANY_REQUESTS", message: "Too many requests, please try again later" },
});

const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 200,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "TOO_MANY_REQUESTS", message: "Too many requests, please try again later" },
});

app.use(globalLimiter);

app.get("/health", async (_req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ status: "healthy", uptime: process.uptime() });
  } catch {
    res.status(503).json({ status: "unhealthy" });
  }
});

app.use("/auth", authLimiter, authRoutes);
app.use("/tenants", tenantRoutes);
app.use("/workflows", workflowRoutes);
app.use("/items", itemRoutes);
app.use("/approvals", approvalsRoutes);
app.use("/sla", slaRoutes);

app.use(notFoundMiddleware);
app.use(errorMiddleware);
