import * as fs from "fs";
import * as path from "path";
import { pool } from "./pool";
import { logger } from "../utils/logger";
import dotenv from "dotenv";

dotenv.config();

async function migrate() {
  const client = await pool.connect();

  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS _migrations (
        id SERIAL PRIMARY KEY,
        filename TEXT NOT NULL UNIQUE,
        applied_at TIMESTAMP WITH TIME ZONE DEFAULT now()
      )
    `);

    const migrationsDir = path.join(__dirname, "migrations");
    const files = fs
      .readdirSync(migrationsDir)
      .filter((f) => f.endsWith(".sql"))
      .sort();

    for (const file of files) {
      const alreadyApplied = await client.query(
        `SELECT 1 FROM _migrations WHERE filename = $1`,
        [file]
      );

      if ((alreadyApplied.rowCount ?? 0) > 0) {
        logger.debug({ file }, "Skipping (already applied)");
        continue;
      }

      const sql = fs.readFileSync(path.join(migrationsDir, file), "utf8");

      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query(
          `INSERT INTO _migrations (filename) VALUES ($1)`,
          [file]
        );
        await client.query("COMMIT");
        logger.info({ file }, "Migration applied");
      } catch (err) {
        await client.query("ROLLBACK");
        throw new Error(`Failed to apply ${file}: ${(err as Error).message}`);
      }
    }

    logger.info("All migrations applied successfully");
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch((err) => {
  logger.error({ err }, "Migration failed");
  process.exit(1);
});
