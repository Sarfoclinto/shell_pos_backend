import { Router } from "express";
import {
  listAdjustments,
  getAdjustmentById,
  createAdjustment,
  approveAdjustment,
  rejectAdjustment,
} from "../controllers/inventory-adjustment.controller.js";
import { authenticate, authorize } from "../middlewares/auth.middleware.js";
import { validate } from "../middlewares/validate.middleware.js";
import {
  createAdjustmentValidator,
  approveAdjustmentValidator,
  rejectAdjustmentValidator,
  listAdjustmentsValidator,
} from "../validators/inventory-adjustment.validator.js";

const router = Router();
router.use(authenticate);

router.get(
  "/",
  authorize("stock.view"),
  validate(listAdjustmentsValidator),
  listAdjustments,
);
router.post(
  "/",
  authorize("stock.adjust"),
  validate(createAdjustmentValidator),
  createAdjustment,
);
router.get("/:id", authorize("stock.view"), getAdjustmentById);
router.patch(
  "/:id/approve",
  authorize("stock.adjust"),
  validate(approveAdjustmentValidator),
  approveAdjustment,
);
router.patch(
  "/:id/reject",
  authorize("stock.adjust"),
  validate(rejectAdjustmentValidator),
  rejectAdjustment,
);

export default router;
