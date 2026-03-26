import { body } from "express-validator";

const networks = ["mtn", "vod", "telecel", "atl"];

export const initiateMobileMoneyChargeValidator = [
  body("amount")
    .notEmpty()
    .withMessage("Amount is required")
    .isFloat({ min: 1 })
    .withMessage("Amount can't be less than 1"),

  body("phone")
    .trim()
    .notEmpty()
    .withMessage("Phone number is required")
    .isLength({ max: 30 })
    .withMessage("Phone number must not exceed 30 characters"),

  body("email")
    .optional({ nullable: true, checkFalsy: true })
    .trim()
    .isEmail()
    .withMessage("A valid email address is required")
    .normalizeEmail(),

  body("saleId").optional({ nullable: true, checkFalsy: true }).trim(),

  body("network")
    .notEmpty()
    .withMessage("Network is required")
    .isIn(networks)
    .withMessage("Invalid network"),
];
