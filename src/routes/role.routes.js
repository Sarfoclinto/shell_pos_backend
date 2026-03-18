import { Router } from "express";
import { asyncHandler } from "../utils/async-handler.js";
import { ApiResponse } from "../utils/api-response.js";
import { authenticate, authorize } from "../middlewares/auth.middleware.js";
import { query } from "../config/database.js";

const router = Router();

router.use(authenticate);

/**
 * GET /api/v1/roles
 * Returns all roles + their assigned controls.
 * Used by the frontend to populate role selectors and permission tables.
 */
router.get(
  "/",
  authorize("users.view"),
  asyncHandler(async (_, res) => {
    const { rows } = await query(
      `SELECT
         r.id,
         r.name,
         r.dashboard_type,
         COALESCE(
           json_agg(
             json_build_object('id', c.id, 'code', c.code, 'name', c.name)
           ) FILTER (WHERE c.id IS NOT NULL),
           '[]'
         ) AS controls
       FROM roles r
       LEFT JOIN role_control_mapping rcm ON rcm.role_id = r.id
       LEFT JOIN controls c ON c.id = rcm.control_id
       GROUP BY r.id
       ORDER BY r.name`,
    );
    return ApiResponse.success(res, rows, "Roles fetched successfully");
  }),
);

/**
 * GET /api/v1/roles/controls
 * Returns every available control code.
 * Used to render the full permission matrix on the admin UI.
 */
router.get(
  "/controls",
  authorize("users.view"),
  asyncHandler(async (_, res) => {
    const { rows } = await query(
      `SELECT id, code, name FROM controls ORDER BY code`,
    );
    return ApiResponse.success(res, rows, "Controls fetched successfully");
  }),
);

export default router;
