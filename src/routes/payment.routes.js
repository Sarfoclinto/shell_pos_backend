import { Router } from "express";
import {
  initiateMobileMoneyCharge,
  submitOtp,
  verifyPayment,
  handleWebhook,
} from "../controllers/payment.controller.js";
import { authenticate } from "../middlewares/auth.middleware.js";
import { authRateLimiter } from "../middlewares/rate-limiter.middleware.js";
import { validate } from "../middlewares/validate.middleware.js";
import { initiateMobileMoneyChargeValidator } from "../validators/payment.validator.js";

const router = Router();

// ── Webhook (no JWT auth — Paystack calls this directly) ──────────────────────
// Must be declared before the authenticate middleware is applied.
// Security is handled by HMAC signature validation inside the handler.
router.post("/my/webhook/url", handleWebhook);

// ── Authenticated routes ──────────────────────────────────────────────────────
router.use(authenticate);

/**
 * Initiate a mobile money charge.
 * Rate limited to prevent abuse — a cashier shouldn't be
 * firing multiple charge requests per second.
 */
router.post(
  "/mobile-money",
  validate(initiateMobileMoneyChargeValidator),
  authRateLimiter,
  initiateMobileMoneyCharge,
);

/**
 * Submit OTP for networks that require it (e.g. Vodafone).
 */
router.post("/mobile-money/otp", submitOtp);

/**
 * Poll transaction status.
 * Frontend calls this every 3–5 seconds after initiating a charge
 * until status is 'success' or 'failed'.
 */
router.get("/verify/:reference", verifyPayment);

export default router;
