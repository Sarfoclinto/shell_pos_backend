import { ApiError } from "../utils/api-error.js";

export const notFound = (req, res, next) => {
  next(ApiError.notFound(`Route not found: ${req.originalUrl}`));
};
