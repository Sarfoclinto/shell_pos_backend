import "dotenv/config";
import app from "./app.js";
import { connectDB } from "./src/config/database.js";
import { logger } from "./src/utils/logger.js";
import { env } from "./src/config/env.js";

const start = async () => {
  // Connect to PostgreSQL before accepting traffic
  await connectDB();

  const server = app.listen(env.PORT, () => {
    logger.info(`🚀 POS API running on port ${env.PORT} [${env.NODE_ENV}]`);
    logger.info(`   → http://localhost:${env.PORT}/api/${env.API_VERSION}`);
    logger.info(`   → http://localhost:${env.PORT}/health`);
    logger.info(`   → http://localhost:${env.PORT}/api-docs`);
  });

  // ─── Graceful Shutdown ─────────────────────
  const shutdown = (signal) => {
    logger.info(`\n${signal} received. Shutting down gracefully...`);
    server.close(() => {
      logger.info("HTTP server closed.");
      process.exit(0);
    });

    // Force exit after 10s
    setTimeout(() => {
      logger.error("Forced shutdown after timeout.");
      process.exit(1);
    }, 10_000);
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));

  process.on("unhandledRejection", (reason) => {
    logger.error("Unhandled Rejection:", reason);
  });

  process.on("uncaughtException", (err) => {
    logger.error("Uncaught Exception:", err);
    process.exit(1);
  });
};

start();
