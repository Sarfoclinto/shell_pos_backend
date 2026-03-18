/**
 * Wraps async route handlers to catch errors and pass to Express error middleware.
 * Eliminates the need for try/catch in every controller.
 */
export const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};
