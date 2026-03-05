import { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { AppError, ValidationError } from "../utils/errors";
import { logger } from "../utils/logger";

interface ErrorResponse {
  error: string;
  message: string;
  details?: unknown;
}

abstract class ErrorHandler {
  abstract canHandle(err: Error): boolean;
  abstract handle(err: Error, req: Request, res: Response): void;
}

class BodyParserErrorHandler extends ErrorHandler {
  canHandle(err: Error): boolean {
    const type = (err as any).type;
    return type === "entity.parse.failed" || type === "entity.too.large";
  }

  handle(err: Error, _req: Request, res: Response): void {
    const type = (err as any).type;

    if (type === "entity.parse.failed") {
      res.status(400).json({ error: "BAD_REQUEST", message: "Malformed JSON in request body" });
      return;
    }

    res.status(413).json({ error: "PAYLOAD_TOO_LARGE", message: "Request body exceeds the size limit" });
  }
}

class ZodErrorHandler extends ErrorHandler {
  canHandle(err: Error): boolean {
    return err instanceof ZodError;
  }

  handle(err: Error, _req: Request, res: Response): void {
    const zodErr = err as ZodError;
    res.status(422).json({
      error: "VALIDATION_ERROR",
      message: "Validation failed",
      details: zodErr.flatten(),
    });
  }
}

class AppErrorHandler extends ErrorHandler {
  canHandle(err: Error): boolean {
    return err instanceof AppError;
  }

  handle(err: Error, req: Request, res: Response): void {
    const appErr = err as AppError;
    logger.warn({ err: appErr.message, code: appErr.code, path: req.path }, "Application error");
    res.status(appErr.statusCode).json(appErr.toJSON());
  }
}

const PG_ERROR_MAP: Record<string, ErrorResponse & { status: number }> = {
  "23505": { status: 409, error: "CONFLICT", message: "Resource already exists" },
  "23503": { status: 422, error: "VALIDATION_ERROR", message: "Referenced resource does not exist" },
  "23502": { status: 422, error: "VALIDATION_ERROR", message: "A required field is missing" },
  "23514": { status: 422, error: "VALIDATION_ERROR", message: "Data constraint violated" },
};

class PostgresErrorHandler extends ErrorHandler {
  canHandle(err: Error): boolean {
    const code = (err as any).code;
    return typeof code === "string" && /^\d{5}$/.test(code);
  }

  handle(err: Error, _req: Request, res: Response): void {
    const pgCode = (err as any).code as string;
    const mapped = PG_ERROR_MAP[pgCode];

    if (mapped) {
      res.status(mapped.status).json({ error: mapped.error, message: mapped.message });
      return;
    }

    logger.error({ pgCode, detail: (err as any).detail }, "Unhandled PostgreSQL error");
    res.status(500).json({ error: "INTERNAL_ERROR", message: "A database error occurred" });
  }
}

class FallbackErrorHandler extends ErrorHandler {
  private isProduction: boolean;

  constructor() {
    super();
    this.isProduction = process.env.NODE_ENV === "production";
  }

  canHandle(): boolean {
    return true;
  }

  handle(err: Error, req: Request, res: Response): void {
    const requestId = (req as any).id;
    logger.error({ err, path: req.path, method: req.method, requestId }, "Unhandled error");
    res.status(500).json({
      error: "INTERNAL_ERROR",
      message: this.isProduction ? "An unexpected error occurred" : err.message || "Internal server error",
      ...(requestId ? { requestId } : {}),
    });
  }
}

const handlers: ErrorHandler[] = [
  new BodyParserErrorHandler(),
  new ZodErrorHandler(),
  new AppErrorHandler(),
  new PostgresErrorHandler(),
  new FallbackErrorHandler(),
];

export function errorMiddleware(err: Error, req: Request, res: Response, _next: NextFunction): void {
  for (const handler of handlers) {
    if (handler.canHandle(err)) {
      handler.handle(err, req, res);
      return;
    }
  }
}

export function notFoundMiddleware(_req: Request, res: Response): void {
  res.status(404).json({ error: "NOT_FOUND", message: "Not found" });
}
