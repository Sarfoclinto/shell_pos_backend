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

/**
 * Get /api/v1/roles/:id/controls
 * Returns all controls assigned to a specific role.
 * Used to populate the permission matrix when editing a role.
 */
router.get(
  "/:id/controls",
  authorize("users.view"),
  asyncHandler(async (req, res) => {
    const { id: roleId } = req.params;

    const { rows: controls } = await query(
      `SELECT c.id, c.code, c.name
        FROM controls c
        JOIN role_control_mapping rcm ON rcm.control_id = c.id
        WHERE rcm.role_id = $1
        ORDER BY c.code`,
      [roleId],
    );

    return ApiResponse.success(
      res,
      controls,
      "Role controls fetched successfully",
    );
  }),
);

/**
 * POST /api/v1/roles/:id/controls
 * Replaces all controls assigned to a role.
 * Body: { controlIds: string[] }
 */
router.post(
  "/:id/controls",
  authenticate,
  authorize("users.update"),
  asyncHandler(async (req, res) => {
    const { id: roleId } = req.params;
    const { controlIds } = req.body;

    // Validate input shape
    if (!Array.isArray(controlIds)) {
      throw ApiError.unprocessable("Validation failed", [
        { field: "controlIds", message: "controlIds must be an array" },
      ]);
    }

    // Confirm the role exists
    const { rows: roleRows } = await query(
      `SELECT id FROM roles WHERE id = $1`,
      [roleId],
    );
    if (!roleRows.length) throw ApiError.notFound("Role not found");

    // Validate all provided control IDs exist
    if (controlIds.length > 0) {
      const { rows: controlRows } = await query(
        `SELECT COUNT(*) FROM controls WHERE id = ANY($1::uuid[])`,
        [controlIds],
      );
      if (parseInt(controlRows[0].count, 10) !== controlIds.length) {
        throw ApiError.badRequest("One or more control IDs are invalid");
      }
    }

    // Replace mappings atomically
    await withTransaction(async (client) => {
      await client.query(
        `DELETE FROM role_control_mapping WHERE role_id = $1`,
        [roleId],
      );
      if (controlIds.length > 0) {
        const placeholders = controlIds
          .map((_, i) => `($1, $${i + 2})`)
          .join(", ");
        await client.query(
          `INSERT INTO role_control_mapping (role_id, control_id)
       VALUES ${placeholders}
       ON CONFLICT (role_id, control_id) DO NOTHING`,
          [roleId, ...controlIds],
        );
      }
    });

    const { rows: updatedControls } = await query(
      `SELECT c.id, c.code, c.name
        FROM controls c
        JOIN role_control_mapping rcm ON rcm.control_id = c.id
        WHERE rcm.role_id = $1
        ORDER BY c.code`,
      [roleId],
    );

    return ApiResponse.success(
      res,
      updatedControls,
      "Role controls updated successfully",
    );
  }),
);

export default router;
