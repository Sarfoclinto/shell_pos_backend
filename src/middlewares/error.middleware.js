import { ApiError } from "../utils/api-error.js";
import { logger } from "../utils/logger.js";
import { env } from "../config/env.js";

/**
 * Global error handler — must be the last middleware registered in app.js.
 *
 * Formats ALL errors into the standard { meta, data } shape regardless
 * of whether they were thrown as ApiError instances or native JS errors.
 */
export const errorHandler = (err, req, res, _) => {
  let error = err;

  // Normalise non-ApiError throws (e.g. pg errors, JSON parse errors)
  if (!(error instanceof ApiError)) {
    // PostgreSQL unique constraint violation
    if (error.code === "23505") {
      error = ApiError.conflict("A record with this value already exists");
    }
    // PostgreSQL foreign key violation
    else if (error.code === "23503") {
      error = ApiError.badRequest("Referenced record does not exist");
    }
    // JSON body parse error from express.json()
    else if (error.type === "entity.parse.failed") {
      error = ApiError.badRequest("Invalid JSON in request body");
    } else {
      const statusCode = error.statusCode || 500;
      error = new ApiError(
        statusCode,
        error.message || "Internal server error",
        [],
        err.stack,
      );
    }
  }

  if (error.statusCode >= 500) {
    logger.error(`[${req.method}] ${req.path} — ${error.message}`, {
      stack: error.stack,
      body: req.body,
      user: req.user?.id,
    });
  }

  return res.status(error.statusCode).json({
    meta: {
      success: false,
      message: error.message,
      status: error.statusCode,
      ...(error.errors?.length ? { errors: error.errors } : {}),
      ...(env.isDev ? { stack: error.stack } : {}),
    },
    data: null,
  });
};
