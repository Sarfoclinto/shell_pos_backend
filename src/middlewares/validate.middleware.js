import { validationResult } from "express-validator";
import { ApiError } from "../utils/api-error.js";

/**
 * Runs an array of express-validator chains, then throws a
 * 422 ApiError with field-level errors if any validation failed.
 *
 * Usage (in a route file):
 *   import { validate } from '../middlewares/validate.middleware.js';
 *   import { loginValidator } from '../validators/auth.validator.js';
 *
 *   router.post('/login', validate(loginValidator), loginController);
 */
export const validate = (validations) => async (req, _, next) => {
  try {
    for (const validation of validations) {
      await validation.run(req);
    }

    const result = validationResult(req);
    if (result.isEmpty()) return next();

    const errors = result.array().map((err) => ({
      field: err.path,
      message: err.msg,
    }));

    throw ApiError.unprocessable("Validation failed", errors);
  } catch (err) {
    next(err);
  }
};