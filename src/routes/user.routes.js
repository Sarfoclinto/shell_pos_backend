import { Router } from "express";
import {
  listUsers,
  getUserById,
  createUser,
  updateUser,
  toggleUserStatus,
  resetPassword,
  deleteUser,
  getUserControls,
  replaceUserControls,
} from "../controllers/user.controller.js";
import { authenticate, authorize } from "../middlewares/auth.middleware.js";
import { validate } from "../middlewares/validate.middleware.js";
import {
  createUserValidator,
  updateUserValidator,
  resetPasswordValidator,
  assignControlsValidator,
  listUsersValidator,
} from "../validators/user.validator.js";

const router = Router();

// All user routes require authentication
router.use(authenticate);

// ── Collection ────────────────────────────────────────────────────────────────
router.get(
  "/",
  authorize("users.view"),
  validate(listUsersValidator),
  listUsers,
);

router.post(
  "/",
  authorize("users.create"),
  validate(createUserValidator),
  createUser,
);

// ── Single resource ───────────────────────────────────────────────────────────
router.get("/:id", authorize("users.view"), getUserById);

router.put(
  "/:id",
  authorize("users.update"),
  validate(updateUserValidator),
  updateUser,
);

router.delete("/:id", authorize("users.delete"), deleteUser);

// ── Actions ───────────────────────────────────────────────────────────────────
router.patch("/:id/toggle-status", authorize("users.update"), toggleUserStatus);

router.patch(
  "/:id/reset-password",
  authorize("users.update"),
  validate(resetPasswordValidator),
  resetPassword,
);

// ── Control overrides ─────────────────────────────────────────────────────────
/**
 * GET /api/v1/users/:id/controls
 * Returns all controls assigned to a specific user, including those inherited from their role.
 * Used to populate the permission matrix when editing a user.
 */
router.get("/:id/controls", authorize("users.view"), getUserControls);


/**
 * PUT /api/v1/users/:id/controls
 * Replaces all controls assigned to a user, overriding their role permissions.
 * Body: { controlIds: string[] }
 */
router.put(
  "/:id/controls",
  authorize("users.update"),
  validate(assignControlsValidator),
  replaceUserControls,
);

export default router;
