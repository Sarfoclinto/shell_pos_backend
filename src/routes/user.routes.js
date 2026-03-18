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
router.get("/:id/controls", authorize("users.view"), getUserControls);

router.put(
  "/:id/controls",
  authorize("users.update"),
  validate(assignControlsValidator),
  replaceUserControls,
);

export default router;
