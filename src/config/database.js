import pg from "pg";
import { env } from "./env.js";
import { logger } from "../utils/logger.js";

const { Pool } = pg;

const pool = new Pool({
  host: env.db.host,
  port: env.db.port,
  database: env.db.name,
  user: env.db.user,
  password: env.db.password,
  min: env.db.poolMin,
  max: env.db.poolMax,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  // SSL is required on Railway — rejectUnauthorized: false handles
  // self-signed certs that Railway uses internally
  ssl: env.db.ssl ? { rejectUnauthorized: false } : false,
});
// for railway deployment. Connect if you are deploying to railway or you want to use railway database
// const pool = new Pool({
//   connectionString: process.env.DATABASE_URL,
//   ssl: {
//     rejectUnauthorized: false,
//   },
// });

pool.on("connect", () => {
  logger.debug("New client connected to the database pool");
});

pool.on("error", (err) => {
  logger.error("Unexpected error on idle database client", err);
  process.exit(-1);
});

/**
 * Execute a single query with optional parameters.
 */
export const query = (text, params) => pool.query(text, params);

/**
 * Get a client from the pool for transactions.
 * Always call client.release() in the finally block.
 */
export const getClient = () => pool.connect();

/**
 * Run a function within a transaction.
 * Automatically commits or rolls back.
 */
export const withTransaction = async (fn) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
};

/**
 * Test DB connectivity on startup.
 */
export const connectDB = async () => {
  try {
    const res = await pool.query("SELECT NOW()");
    logger.info(
      `✅ PostgreSQL connected — ${env.db.host}:${env.db.port}/${env.db.name}`,
    );
    logger.info(`   Server time: ${res.rows[0].now}`);
  } catch (err) {
    logger.error("❌ Failed to connect to PostgreSQL:", err.message);
    process.exit(1);
  }
};

export default pool;
