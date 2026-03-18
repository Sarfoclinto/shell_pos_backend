import { Router } from "express";
import {
  listSales,
  getSaleByReceipt,
  getSaleById,
  createSale,
  cancelSale,
} from "../controllers/sale.controller.js";
import {
  authenticate,
  authorize,
  requireShift,
} from "../middlewares/auth.middleware.js";
import { validate } from "../middlewares/validate.middleware.js";
import {
  createSaleValidator,
  cancelSaleValidator,
  receiptParamValidator,
  listSalesValidator,
} from "../validators/sale.validator.js";

const router = Router();

router.use(authenticate);

// ── Static paths before /:id ──────────────────────────────────────────────────
router.get(
  "/receipt/:receiptNumber",
  authorize("sales.view"),
  validate(receiptParamValidator),
  getSaleByReceipt,
);

// ── Collection ────────────────────────────────────────────────────────────────
router.get(
  "/",
  authorize("sales.view"),
  validate(listSalesValidator),
  listSales,
);

/**
 * Creating a sale requires:
 * 1. authenticate   — valid JWT
 * 2. requireShift   — user must have an open shift (attaches req.shift)
 * 3. authorize      — user must have sales.create control
 */
router.post(
  "/",
  requireShift,
  authorize("sales.create"),
  validate(createSaleValidator),
  createSale,
);

// ── Single resource ───────────────────────────────────────────────────────────
router.get("/:id", authorize("sales.view"), getSaleById);

router.patch(
  "/:id/cancel",
  authorize("sales.cancel"),
  validate(cancelSaleValidator),
  cancelSale,
);

export default router;
