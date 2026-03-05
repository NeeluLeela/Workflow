import "./db/pool";
import { app } from "./app";
import { pool } from "./db/pool";
import { startSlaJob } from "./jobs/slaChecker";
import { logger } from "./utils/logger";
import http from "http";

const requiredEnv = ["JWT_SECRET", "DATABASE_URL"] as const;
for (const key of requiredEnv) {
  if (!process.env[key]) {
    logger.fatal(`${key} environment variable is not set`);
    process.exit(1);
  }
}

const PORT = parseInt(process.env.PORT || "3000", 10);

let server: http.Server;
let slaInterval: NodeJS.Timeout;

async function start() {
  try {
    await pool.query("SELECT 1");
    logger.info("Database connection successful");

    server = app.listen(PORT, () => {
      logger.info({ port: PORT, env: process.env.NODE_ENV || "development" }, "Server running");
      slaInterval = startSlaJob();
    });

    server.keepAliveTimeout = 65_000;
    server.headersTimeout = 66_000;
  } catch (err) {
    logger.fatal({ err }, "Failed to start server");
    process.exit(1);
  }
}

async function shutdown(signal: string) {
  logger.info({ signal }, "Shutdown signal received, closing gracefully...");

  if (slaInterval) clearInterval(slaInterval);

  if (server) {
    server.close(() => {
      logger.info("HTTP server closed");
    });
  }

  try {
    await pool.end();
    logger.info("Database pool closed");
  } catch (err) {
    logger.error({ err }, "Error closing database pool");
  }

  setTimeout(() => {
    logger.warn("Forceful shutdown after timeout");
    process.exit(1);
  }, 10_000).unref();

  process.exit(0);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

process.on("unhandledRejection", (reason) => {
  logger.error({ err: reason }, "Unhandled promise rejection");
});

process.on("uncaughtException", (err) => {
  logger.fatal({ err }, "Uncaught exception — shutting down");
  shutdown("uncaughtException");
});

start();
