/**
 * Structured error class.
 *
 * Thrown anywhere in the app — the global error middleware
 * catches it and formats it into the standard { meta, data } shape.
 *
 * Usage:
 *   throw ApiError.notFound('User not found');
 *   throw ApiError.unprocessable('Validation failed', fieldErrors);
 */
export class ApiError extends Error {
  constructor(statusCode, message, errors = [], stack = "") {
    super(message);
    this.statusCode = statusCode;
    this.message = message;
    this.errors = errors; // FieldError[] for validation
    this.success = false;

    if (stack) {
      this.stack = stack;
    } else {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  // ── Static factories ──────────────────────────

  static badRequest(message, errors = []) {
    return new ApiError(400, message, errors);
  }

  static unauthorized(message = "Unauthorized") {
    return new ApiError(401, message);
  }

  static forbidden(
    message = "You do not have permission to perform this action",
  ) {
    return new ApiError(403, message);
  }

  static notFound(message = "Resource not found") {
    return new ApiError(404, message);
  }

  static conflict(message) {
    return new ApiError(409, message);
  }

  static unprocessable(message = "Validation failed", errors = []) {
    return new ApiError(422, message, errors);
  }

  static internal(message = "Internal server error") {
    return new ApiError(500, message);
  }
}
