import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { ApiError } from "../utils/api-error.js";
import { asyncHandler } from "../utils/async-handler.js";
import { query } from "../config/database.js";

/**
 * authenticate
 * Verifies the Bearer JWT, loads the user + their controls from the DB,
 * and attaches them to req.user.
 *
 * req.user shape:
 * {
 *   id, firstName, lastName, email, phone,
 *   role: { id, name, dashboardType },
 *   storeId,
 *   controls: Set<string>   // e.g. Set{ 'sales.create', 'reports.view' }
 * }
 */
export const authenticate = asyncHandler(async (req, _, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    throw ApiError.unauthorized("No token provided");
  }

  const token = authHeader.split(" ")[1];
  let decoded;

  try {
    decoded = jwt.verify(token, env.jwt.secret);
  } catch (err) {
    if (err.name === "TokenExpiredError")
      throw ApiError.unauthorized("Token has expired");
    throw ApiError.unauthorized("Invalid token");
  }

  // Load user + role + effective controls in one query.
  // Effective controls = role-level controls + user-level overrides (union).
  const { rows } = await query(
    `SELECT
       u.id,
       u.first_name,
       u.last_name,
       u.email,
       u.phone,
       u.store_id,
       u.is_active,
       r.id           AS role_id,
       r.name         AS role_name,
       r.dashboard_type,
       ARRAY(
         SELECT c.code FROM controls c
         INNER JOIN role_control_mapping rcm ON rcm.control_id = c.id
         WHERE rcm.role_id = r.id
         UNION
         SELECT c2.code FROM controls c2
         INNER JOIN user_control_mapping ucm ON ucm.control_id = c2.id
         WHERE ucm.user_id = u.id
       ) AS controls
     FROM users u
     INNER JOIN roles r ON r.id = u.role_id
     WHERE u.id = $1 AND u.deleted_at IS NULL`,
    [decoded.id],
  );

  const user = rows[0];
  if (!user) throw ApiError.unauthorized("User no longer exists");
  if (!user.is_active)
    throw ApiError.forbidden("Your account has been deactivated");

  req.user = {
    id: user.id,
    firstName: user.first_name,
    lastName: user.last_name,
    email: user.email,
    phone: user.phone,
    storeId: user.store_id,
    role: {
      id: user.role_id,
      name: user.role_name,
      dashboardType: user.dashboard_type,
    },
    controls: new Set(user.controls),
  };

  next();
});

/**
 * authorize(...controlCodes)
 * Checks that req.user has at least one of the given control codes.
 *
 * Usage:
 *   router.post('/', authenticate, authorize('sales.create'), createSale);
 */
export const authorize =
  (...controlCodes) =>
  (req, res, next) => {
    if (!req.user) throw ApiError.unauthorized();

    const hasPermission = controlCodes.some((code) =>
      req.user.controls.has(code),
    );
    if (!hasPermission) {
      throw ApiError.forbidden(
        `Required permission: ${controlCodes.join(" or ")}`,
      );
    }
    next();
  };

/**
 * requireShift
 * Ensures the cashier has an open shift before allowing the action.
 * Attaches req.shift for downstream use (e.g. when creating a sale).
 */
export const requireShift = asyncHandler(async (req, res, next) => {
  const { rows } = await query(
    `SELECT id, store_id, opening_float
     FROM shifts
     WHERE user_id = $1
       AND store_id = $2
       AND status = 'open'
     LIMIT 1`,
    [req.user.id, req.user.storeId],
  );

  if (!rows.length) {
    throw ApiError.forbidden(
      "You must open a shift before performing this action",
    );
  }

  req.shift = rows[0];
  next();
});
