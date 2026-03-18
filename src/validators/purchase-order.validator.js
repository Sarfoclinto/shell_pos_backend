import { body, query } from "express-validator";

export const createPurchaseOrderValidator = [
  body("supplierId").isUUID().withMessage("supplierId must be a valid UUID"),

  body("expectedDeliveryDate")
    .optional({ nullable: true, checkFalsy: true })
    .isISO8601()
    .withMessage("expectedDeliveryDate must be a valid date"),

  body("notes")
    .optional({ nullable: true, checkFalsy: true })
    .trim()
    .isLength({ max: 500 })
    .withMessage("Notes must not exceed 500 characters"),

  body("items")
    .isArray({ min: 1 })
    .withMessage("A purchase order must have at least one item"),

  body("items.*.productId")
    .isUUID()
    .withMessage("Each item must have a valid productId"),

  body("items.*.quantityOrdered")
    .isInt({ min: 1 })
    .withMessage("Quantity ordered must be at least 1"),

  body("items.*.unitPrice")
    .isFloat({ min: 0 })
    .withMessage("Unit price must be a non-negative number"),
];

export const receiveItemsValidator = [
  body("items")
    .isArray({ min: 1 })
    .withMessage("At least one item is required"),

  body("items.*.purchaseOrderItemId")
    .isUUID()
    .withMessage("Each item must have a valid purchaseOrderItemId"),

  body("items.*.quantityReceived")
    .isInt({ min: 1 })
    .withMessage("Quantity received must be at least 1"),
];

export const listPurchaseOrdersValidator = [
  query("page").optional().isInt({ min: 1 }),
  query("limit").optional().isInt({ min: 1, max: 100 }),
  query("storeId").optional().isUUID(),
  query("supplierId").optional().isUUID(),
  query("status")
    .optional()
    .isIn(["pending", "ordered", "received", "cancelled"])
    .withMessage("Invalid status"),
  query("from").optional().isISO8601(),
  query("to").optional().isISO8601(),
];
