import { Router } from "express";
import {
  listTransfers,
  getTransferById,
  createTransfer,
  approveTransfer,
  completeTransfer,
  cancelTransfer,
} from "../controllers/stock-transfer.controller.js";
import { authenticate, authorize } from "../middlewares/auth.middleware.js";
import { validate } from "../middlewares/validate.middleware.js";
import {
  createTransferValidator,
  approveTransferValidator,
  rejectTransferValidator,
  listTransfersValidator,
} from "../validators/stock-transfer.validator.js";

const router = Router();
router.use(authenticate);

router.get(
  "/",
  authorize("stock.view"),
  validate(listTransfersValidator),
  listTransfers,
);
router.post(
  "/",
  authorize("stock.transfer"),
  validate(createTransferValidator),
  createTransfer,
);
router.get("/:id", authorize("stock.view"), getTransferById);
router.patch(
  "/:id/approve",
  authorize("stock.transfer"),
  validate(approveTransferValidator),
  approveTransfer,
);
router.patch("/:id/complete", authorize("stock.transfer"), completeTransfer);
router.patch(
  "/:id/cancel",
  authorize("stock.transfer"),
  validate(rejectTransferValidator),
  cancelTransfer,
);

export default router;
