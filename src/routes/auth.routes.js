import { Router } from "express";
import {
  login,
  refresh,
  logout,
  getMe,
  changePassword,
} from "../controllers/auth.controller.js";
import { authenticate } from "../middlewares/auth.middleware.js";
import { authRateLimiter } from "../middlewares/rate-limiter.middleware.js";
import { validate } from "../middlewares/validate.middleware.js";
import {
  loginValidator,
  refreshValidator,
  changePasswordValidator,
} from "../validators/auth.validator.js";

const router = Router();

/**
 * Public routes (no token required)
 */
router.post("/login", authRateLimiter, validate(loginValidator), login);
router.post("/refresh", authRateLimiter, validate(refreshValidator), refresh);

/**
 * Protected routes
 */
router.post("/logout", authenticate, logout);
router.get("/me", authenticate, getMe);
router.patch(
  "/change-password",
  authenticate,
  validate(changePasswordValidator),
  changePassword,
);

export default router;
