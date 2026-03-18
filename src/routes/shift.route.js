import { Router } from "express";
import {
  openShift,
  closeShift,
  getCurrentShift,
  listShifts,
  getShiftById,
} from "../controllers/shift.controller.js";
import { authenticate, authorize } from "../middlewares/auth.middleware.js";
import { validate } from "../middlewares/validate.middleware.js";
import {
  openShiftValidator,
  closeShiftValidator,
  listShiftsValidator,
} from "../validators/shift.validator.js";

const router = Router();

router.use(authenticate);

// ── Cashier actions (own shift) ───────────────────────────────────────────────
router.post(
  "/open",
  authorize("shifts.manage"),
  validate(openShiftValidator),
  openShift,
);

router.post(
  "/close",
  authorize("shifts.manage"),
  validate(closeShiftValidator),
  closeShift,
);

router.get("/current", authorize("shifts.manage"), getCurrentShift);

// ── Admin / Manager views ─────────────────────────────────────────────────────
// Note: /current must be declared before /:id so Express does not
// treat the literal string "current" as a UUID parameter.
router.get(
  "/",
  authorize("reports.view"),
  validate(listShiftsValidator),
  listShifts,
);

router.get("/:id", authorize("reports.view"), getShiftById);

export default router;
