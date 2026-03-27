import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { userRepository } from "../repositories/user.repository.js";
import { ApiError } from "../utils/api-error.js";
import { shiftService } from "./shift.service.js";

// ── Token helpers ─────────────────────────────────────────────────────────────

const buildTokenPayload = (user) => ({
  id: user.id,
  storeId: user.store_id,
  role: user.role_name,
});

const signAccessToken = (payload) =>
  jwt.sign(payload, env.jwt.secret, { expiresIn: env.jwt.expiresIn });

const signRefreshToken = (payload) =>
  jwt.sign(payload, env.jwt.refreshSecret, {
    expiresIn: env.jwt.refreshExpiresIn,
  });

// ── Serialiser ────────────────────────────────────────────────────────────────

/**
 * Shape the user object that goes into every auth response.
 * Never exposes password_hash or internal DB fields.
 */
const serializeUser = (user, shift = null) => ({
  id: user.id,
  firstName: user.first_name,
  lastName: user.last_name,
  email: user.email ?? null,
  phone: user.phone,
  storeId: user.store_id ?? null,
  storeName: user.store_name ?? null,
  storeCode: user.store_code ?? null,

  role: {
    id: user.role_id,
    name: user.role_name,
    dashboardType: user.dashboard_type,
  },

  permissions: user.permissions ?? [],

  isActive: user.is_active,
  lastLoginAt: user.last_login_at ?? null,

  shift,
});
// ── Service ───────────────────────────────────────────────────────────────────

export const authService = {
  /**
   * Login with email OR phone + password.
   * Returns access token, refresh token, and the serialised user.
   */
  async login(emailOrPhone, password) {
    const user = await userRepository.findByEmailOrPhone(emailOrPhone);

    // Deliberately vague — don't reveal whether the identifier exists
    if (!user) {
      throw ApiError.unauthorized("Invalid credentials");
    }

    if (!user.is_active) {
      throw ApiError.forbidden(
        "Your account has been deactivated. Contact your administrator.",
      );
    }

    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      throw ApiError.unauthorized("Invalid credentials");
    }

    await userRepository.updateLastLogin(user.id);

    const payload = buildTokenPayload(user);

    // if user role is cashier, find and attach his currently open shift else make shif property null
    let shift = null;
    if (user.dashboard_type === "cashier") {
      shift = await shiftService.getCurrent(user.id, user.store_id);
    }

    return {
      accessToken: signAccessToken(payload),
      refreshToken: signRefreshToken(payload),
      user: serializeUser(user, shift),
    };
  },

  /**
   * Issue a new access token from a valid refresh token.
   */
  async refresh(refreshToken) {
    let decoded;
    try {
      decoded = jwt.verify(refreshToken, env.jwt.refreshSecret);
    } catch (err) {
      if (err.name === "TokenExpiredError") {
        throw ApiError.unauthorized(
          "Refresh token has expired. Please log in again.",
        );
      }
      throw ApiError.unauthorized("Invalid refresh token");
    }

    const user = await userRepository.findByIdSafe(decoded.id);
    if (!user) throw ApiError.unauthorized("User no longer exists");
    if (!user.is_active)
      throw ApiError.forbidden("Account has been deactivated");

    return {
      accessToken: signAccessToken(
        buildTokenPayload({ ...user, role_name: user.role_name }),
      ),
    };
  },

  /**
   * Return the currently authenticated user's profile.
   */
  async getMe(userId) {
    const user = await userRepository.findByIdSafe(userId);
    if (!user) throw ApiError.notFound("User not found");
    return serializeUser(user);
  },

  /**
   * Change password — requires current password for verification.
   */
  async changePassword(userId, currentPassword, newPassword) {
    // Need the full row with password_hash for verification
    const { rows } = await import("../config/database.js").then((m) =>
      m.query(`SELECT password_hash FROM users WHERE id = $1`, [userId]),
    );
    const user = rows[0];
    if (!user) throw ApiError.notFound("User not found");

    const isValid = await bcrypt.compare(currentPassword, user.password_hash);
    if (!isValid) throw ApiError.badRequest("Current password is incorrect");

    if (currentPassword === newPassword) {
      throw ApiError.badRequest(
        "New password must be different from current password",
      );
    }

    const hash = await bcrypt.hash(newPassword, 12);
    await userRepository.updatePassword(userId, hash);
  },
};
