import { Router } from "express";
import {
  listSalesReturns,
  getSalesReturnById,
  createSalesReturn,
  approveSalesReturn,
  rejectSalesReturn,
} from "../controllers/sales-return.controller.js";
import { authenticate, authorize } from "../middlewares/auth.middleware.js";
import { validate } from "../middlewares/validate.middleware.js";
import {
  createSalesReturnValidator,
  approveReturnValidator,
  rejectReturnValidator,
  listSalesReturnsValidator,
} from "../validators/sales-return.validator.js";

const router = Router();
router.use(authenticate);

router.get(
  "/",
  authorize("sales.view"),
  validate(listSalesReturnsValidator),
  listSalesReturns,
);
router.post(
  "/",
  authorize("sales.return"),
  validate(createSalesReturnValidator),
  createSalesReturn,
);
router.get("/:id", authorize("sales.view"), getSalesReturnById);
router.patch(
  "/:id/approve",
  authorize("sales.cancel"),
  validate(approveReturnValidator),
  approveSalesReturn,
);
router.patch(
  "/:id/reject",
  authorize("sales.cancel"),
  validate(rejectReturnValidator),
  rejectSalesReturn,
);

export default router;
