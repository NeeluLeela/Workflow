import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { pool } from "../../db/pool";
import { ConflictError, NotFoundError, UnauthorizedError } from "../../utils/errors";
import { logger } from "../../utils/logger";

const JWT_SECRET = process.env.JWT_SECRET as string;

export async function registerUser(email: string, password: string) {
  const hashedPassword = await bcrypt.hash(password, 10);

  try {
    const result = await pool.query(
      `INSERT INTO users (email, password_hash)
       VALUES ($1, $2)
       RETURNING id, email, created_at`,
      [email, hashedPassword]
    );

    logger.info({ email }, "User registered");
    return result.rows[0];
  } catch (err: unknown) {
    if ((err as { code?: string }).code === "23505") {
      throw new ConflictError("Email already exists");
    }
    throw err;
  }
}

export async function loginUser(email: string, password: string) {
  const result = await pool.query(
    `SELECT id, email, password_hash FROM users WHERE email = $1`,
    [email]
  );

  const user = result.rows[0];

  if (!user) {
    throw new UnauthorizedError("Invalid credentials");
  }

  const isValid = await bcrypt.compare(password, user.password_hash);

  if (!isValid) {
    throw new UnauthorizedError("Invalid credentials");
  }

  const token = jwt.sign({ userId: user.id }, JWT_SECRET, {
    expiresIn: "1h",
  });

  logger.info({ userId: user.id }, "User logged in");

  return {
    token,
    user: { id: user.id, email: user.email },
  };
}

export async function getCurrentUser(userId: string) {
  const result = await pool.query(
    `SELECT id, email FROM users WHERE id = $1`,
    [userId]
  );

  if ((result.rowCount ?? 0) === 0) {
    throw new NotFoundError("User", userId);
  }

  return result.rows[0];
}
