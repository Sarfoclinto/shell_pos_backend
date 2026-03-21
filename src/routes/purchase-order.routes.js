import { Router } from "express";
import {
  listPurchaseOrders,
  getPurchaseOrderById,
  createPurchaseOrder,
  markOrdered,
  receiveItems,
  cancelPurchaseOrder,
} from "../controllers/purchase-order.controller.js";
import { authenticate, authorize } from "../middlewares/auth.middleware.js";
import { validate } from "../middlewares/validate.middleware.js";
import {
  createPurchaseOrderValidator,
  receiveItemsValidator,
  listPurchaseOrdersValidator,
} from "../validators/purchase-order.validator.js";

const router = Router();
router.use(authenticate);

router.get(
  "/",
  authorize("purchase_orders.view"),
  validate(listPurchaseOrdersValidator),
  listPurchaseOrders,
);
router.post(
  "/",
  authorize("purchase_orders.manage"),
  validate(createPurchaseOrderValidator),
  createPurchaseOrder,
);
router.get("/:id", authorize("purchase_orders.view"), getPurchaseOrderById);
router.patch(
  "/:id/mark-ordered",
  authorize("purchase_orders.manage"),
  markOrdered,
);
router.patch(
  "/:id/receive",
  authorize("purchase_orders.manage"),
  validate(receiveItemsValidator),
  receiveItems,
);
router.patch(
  "/:id/cancel",
  authorize("purchase_orders.manage"),
  cancelPurchaseOrder,
);

export default router;
