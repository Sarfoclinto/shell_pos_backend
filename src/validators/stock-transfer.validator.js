import { body, query } from "express-validator";

export const createTransferValidator = [
  body("toStoreId").isUUID().withMessage("toStoreId must be a valid UUID"),

  body("notes")
    .optional({ nullable: true, checkFalsy: true })
    .trim()
    .isLength({ max: 500 }),

  body("items")
    .isArray({ min: 1 })
    .withMessage("A transfer must have at least one item"),

  body("items.*.productId")
    .isUUID()
    .withMessage("Each item must have a valid productId"),

  body("items.*.quantity")
    .isInt({ min: 1 })
    .withMessage("Transfer quantity must be at least 1"),
];

export const approveTransferValidator = [
  body("notes")
    .optional({ nullable: true, checkFalsy: true })
    .trim()
    .isLength({ max: 500 }),
];

export const rejectTransferValidator = [
  body("notes")
    .trim()
    .notEmpty()
    .withMessage("A reason for rejection is required")
    .isLength({ max: 500 }),
];

export const listTransfersValidator = [
  query("page").optional().isInt({ min: 1 }),
  query("limit").optional().isInt({ min: 1, max: 100 }),
  query("storeId").optional().isUUID(),
  query("status")
    .optional()
    .isIn(["pending", "in_transit", "completed", "cancelled"])
    .withMessage("Invalid status"),
  query("from").optional().isISO8601(),
  query("to").optional().isISO8601(),
];
