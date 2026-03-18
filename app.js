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


// ─────────────────────────────────────────────
// Health Check
// ─────────────────────────────────────────────
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    environment: env.NODE_ENV,
    timestamp: new Date().toISOString(),
  });
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
