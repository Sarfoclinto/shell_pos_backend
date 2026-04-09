import { Router } from "express";
import jwt from "jsonwebtoken";
import { scannerSessions } from "./scanner.sessions.js";
import { authenticate } from "../middlewares/auth.middleware.js";
import { asyncHandler } from "../utils/async-handler.js";
import { ApiResponse } from "../utils/api-response.js";
import { ApiError } from "../utils/api-error.js";
import { env } from "../config/env.js";

const router = Router();

// POST /api/v1/scanner/session
// Called by the web POS when cashier clicks "Connect Scanner"
// Auth: regular cashier/admin token
router.post(
  "/session",
  authenticate,
  asyncHandler(async (req, res) => {
    // Note: auth middleware maps store_id to storeId
    const session = scannerSessions.create(req.user.id, req.user.storeId);
    return ApiResponse.created(res, session, "Scanner session created");
  }),
);

// POST /api/v1/scanner/pair
// Called by the mobile app after scanning the QR code
// No auth required (PIN is the auth mechanism)
router.post(
  "/pair",
  asyncHandler(async (req, res) => {
    const { sessionId, pin } = req.body;
    if (!sessionId || !pin) {
      throw ApiError.badRequest("sessionId and pin are required");
    }

    const result = scannerSessions.validate(sessionId, pin);
    if (!result.valid) {
      throw ApiError.unauthorized(result.reason);
    }

    // Issue a short-lived scanner JWT
    // This token ONLY allows socket connection — it cannot hit any other endpoint
    const scannerToken = jwt.sign(
      {
        role: "scanner",
        sessionId,
        userId: result.session.userId,
        storeId: result.session.storeId,
      },
      env.jwt.secret,
      { expiresIn: "8h" },
    );

    return ApiResponse.success(res, { scannerToken, sessionId }, "Paired successfully");
  }),
);

// DELETE /api/v1/scanner/session/:sessionId
// Called when cashier disconnects from the web side
router.delete(
  "/session/:sessionId",
  authenticate,
  asyncHandler(async (req, res) => {
    scannerSessions.delete(req.params.sessionId);
    return ApiResponse.noContent(res, "Session terminated");
  }),
);

export default router;
