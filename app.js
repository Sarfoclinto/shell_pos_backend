import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import { corsOptions } from "./src/config/cors-options.js";
import { globalRateLimiter } from "./src/middlewares/rate-limiter.middleware.js";
import { httpLogger } from "./src/middlewares/logger.middleware.js";
import { errorHandler } from "./src/middlewares/error.middleware.js";
import { notFound } from "./src/middlewares/not-found.middleware.js";
import { env } from "./src/config/env.js";
import apiRoutes from "./src/routes/index.js";
import swaggerUi from "swagger-ui-express";
import { query } from "./src/config/database.js";
import { swaggerSpec } from "./src/config/swagger.js";

const app = express();

// ─────────────────────────────────────────────
// Security & Performance
// ─────────────────────────────────────────────
app.use(helmet());
app.use(cors(corsOptions));
app.use(compression());

// ─────────────────────────────────────────────
// Request Parsing
// ─────────────────────────────────────────────
app.use(express.json({ limit: "10kb" }));
app.use(express.urlencoded({ extended: true, limit: "10kb" }));

// ─────────────────────────────────────────────
// Logging & Rate Limiting
// ─────────────────────────────────────────────
app.use(httpLogger);
app.use(globalRateLimiter);

app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));


// ── Health Check ──────────────────────────────────────────────────────────────
// Railway pings this endpoint to confirm the service is alive.
// Returns 200 only when the DB is reachable — this is intentional.
// If the DB is down, Railway will restart the service.
app.get('/health', async (_, res) => {
  try {
    const result = await query('SELECT NOW()');
    return res.status(200).json({
      status:      'ok',
      environment: env.NODE_ENV,
      database:    'connected',
      timestamp:   result.rows[0].now,
    });
  } catch (err) {
    return res.status(503).json({
      status:   'error',
      database: 'disconnected',
      message:  err.message,
    });
  }
});

// ─────────────────────────────────────────────
// API Routes
// ─────────────────────────────────────────────
app.use(`/api/${env.API_VERSION}`, apiRoutes);

// ─────────────────────────────────────────────
// Error Handling (must be last)
// ─────────────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

export default app;
