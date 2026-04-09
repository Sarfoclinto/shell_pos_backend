import "dotenv/config";
import http from "http";
import app from "./app.js";
import { connectDB } from "./src/config/database.js";
// import { runMigrations } from "./src/db/migrate.js";
// import { seedUsers } from "./src/db/seeds/001_seed_users.js";
// import { query } from "./src/config/database.js";
import { initSocketServer } from "./src/socket/index.js";
import { logger } from "./src/utils/logger.js";
import { env } from "./src/config/env.js";

const start = async () => {
  // ── Database ────────────────────────────────────────────────────────────────
  await connectDB();
  // await runMigrations();
  // await seedUsers(query);

  // ── HTTP Server ─────────────────────────────────────────────────────────────
  // Create a raw http.Server from the Express app so Socket.IO
  // can share the same port — no second port needed.
  const httpServer = http.createServer(app);

  // ── Socket.IO ───────────────────────────────────────────────────────────────
  const io = initSocketServer(httpServer);

  // Attach io to app so controllers can access it if ever needed
  // (prefer the event bus, but this is available as an escape hatch)
  app.set("io", io);

  // ── Start listening ─────────────────────────────────────────────────────────
  httpServer.listen(env.PORT, () => {
    if (isDev) {
      logger.info(`🚀 POS API running on port ${env.PORT} [${env.NODE_ENV}]`);
      logger.info(`   → http://localhost:${env.PORT}/api/${env.API_VERSION}`);
      logger.info(`   → http://localhost:${env.PORT}/health`);
      logger.info(`   → ws://localhost:${env.PORT}  (Socket.IO)`);
    } else {
      logger.info(`🚀 POS API running on port ${env.PORT} [${env.NODE_ENV}]`);
      logger.info(
        `   → https://shell-pos-backend.onrender.com/api/${env.API_VERSION}`,
      );
      logger.info(`   → https://shell-pos-backend.onrender.com/health`);
      logger.info(`   → wss://shell-pos-backend.onrender.com (Socket.IO)`);
    }
  });

  // ── Graceful Shutdown ───────────────────────────────────────────────────────
  const shutdown = (signal) => {
    logger.info(`\n${signal} received — shutting down gracefully...`);
    httpServer.close(() => {
      logger.info("HTTP + WebSocket server closed.");
      process.exit(0);
    });
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
