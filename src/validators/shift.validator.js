import { body, query } from "express-validator";

export const openShiftValidator = [
  body("openingFloat")
    .notEmpty()
    .withMessage("Opening float is required")
    .isFloat({ min: 0 })
    .withMessage("Opening float must be a non-negative number"),
];

export const closeShiftValidator = [
  body("closingCash")
    .notEmpty()
    .withMessage("Closing cash is required")
    .isFloat({ min: 0 })
    .withMessage("Closing cash must be a non-negative number"),

  body("notes")
    .optional({ nullable: true, checkFalsy: true })
    .trim()
    .isLength({ max: 500 })
    .withMessage("Notes must not exceed 500 characters"),
];

export const listShiftsValidator = [
  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Page must be a positive integer"),

  query("limit")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("Limit must be between 1 and 100"),

  query("storeId")
    .optional()
    .isUUID()
    .withMessage("storeId must be a valid UUID"),

  query("userId")
    .optional()
    .isUUID()
    .withMessage("userId must be a valid UUID"),

  query("status")
    .optional()
    .isIn(["open", "closed"])
    .withMessage('status must be "open" or "closed"'),

  query("from")
    .optional()
    .isISO8601()
    .withMessage("from must be a valid ISO 8601 date"),

  query("to")
    .optional()
    .isISO8601()
    .withMessage("to must be a valid ISO 8601 date"),
];
