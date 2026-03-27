import { query, connectDB } from "../config/database.js";
import { logger } from "../utils/logger.js";

// Import all migrations in order
// import {
//   up as migration001,
//   down as rollback001,
// } from "./migrations/001_initial_schema.js";
import {
  up as migration002,
  down as rollback002,
} from "./migrations/002_full_schema.js";
import {
  up as migration003,
  down as rollback003,
} from "./migrations/003_alter_schema.js";

const migrations = [
  // { name: "001_initial_schema", up: migration001, down: rollback001 },
  { name: "002_full_schema", up: migration002, down: rollback002 },
  { name: "003_alter_schema", up: migration003, down: rollback003 },
];

const ensureMigrationsTable = async () => {
  await query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id        SERIAL PRIMARY KEY,
      name      VARCHAR(255) NOT NULL UNIQUE,
      run_at    TIMESTAMPTZ DEFAULT NOW()
    )
  `);
};

const getRunMigrations = async () => {
  const { rows } = await query("SELECT name FROM _migrations ORDER BY id");
  return rows.map((r) => r.name);
};

export const runMigrations = async () => {
  await connectDB();
  await ensureMigrationsTable();

  const completed = await getRunMigrations();
  const pending = migrations.filter((m) => !completed.includes(m.name));

  if (!pending.length) {
    logger.info("✅ All migrations are up to date.");
    return;
  }

  for (const migration of pending) {
    logger.info(`⏳ Running migration: ${migration.name}`);
    await migration.up(query);
    await query("INSERT INTO _migrations (name) VALUES ($1)", [migration.name]);
    logger.info(`✅ Completed: ${migration.name}`);
  }
};

export const rollbackLast = async () => {
  await connectDB();
  await ensureMigrationsTable();

  const completed = await getRunMigrations();
  if (!completed.length) {
    logger.info("Nothing to rollback.");
    return;
  }

  const lastName = completed[completed.length - 1];
  const migration = migrations.find((m) => m.name === lastName);

  if (!migration) {
    logger.warn(`No rollback function found for: ${lastName}`);
    return;
  }

  logger.info(`⏳ Rolling back: ${lastName}`);
  await migration.down(query);
  await query("DELETE FROM _migrations WHERE name = $1", [lastName]);
  logger.info(`✅ Rolled back: ${lastName}`);
};

// CLI entrypoint
const isRollback = process.argv[2] === "rollback";
if (isRollback) {
  rollbackLast()
    .then(() => process.exit(0))
    .catch((e) => {
      logger.error(e);
      process.exit(1);
    });
} else {
  runMigrations()
    .then(() => process.exit(0))
    .catch((e) => {
      logger.error(e);
      process.exit(1);
    });
}
