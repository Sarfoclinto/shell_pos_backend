import { body, query } from "express-validator";

export const createUserValidator = [
  body("firstName")
    .trim()
    .notEmpty()
    .withMessage("First name is required")
    .isLength({ max: 100 })
    .withMessage("First name must not exceed 100 characters"),

  body("lastName")
    .trim()
    .notEmpty()
    .withMessage("Last name is required")
    .isLength({ max: 100 })
    .withMessage("Last name must not exceed 100 characters"),

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

  body("password")
    .isLength({ min: 8 })
    .withMessage("Password must be at least 8 characters")
    .matches(/[A-Z]/)
    .withMessage("Password must contain at least one uppercase letter")
    .matches(/[0-9]/)
    .withMessage("Password must contain at least one number"),

  body("img")
    .optional({ nullable: true, checkFalsy: true })
    .isURL()
    .withMessage("Image URL must be a valid URL"),

  body("roleId")
    .trim()
    .notEmpty()
    .withMessage("Role ID is required")
    .isUUID()
    .withMessage("Role ID must be a valid UUID"),

  body("storeId")
    .optional({ nullable: true, checkFalsy: true })
    .isUUID()
    .withMessage("Store ID must be a valid UUID"),

  body("address")
    .optional({ nullable: true, checkFalsy: true })
    .trim()
    .isLength({ max: 500 })
    .withMessage("Address must not exceed 500 characters"),

  body("region")
    .optional({ nullable: true, checkFalsy: true })
    .trim()
    .isLength({ max: 100 })
    .withMessage("Region must not exceed 100 characters"),

  body("city")
    .optional({ nullable: true, checkFalsy: true })
    .trim()
    .isLength({ max: 100 })
    .withMessage("City must not exceed 100 characters"),
];

export const updateUserValidator = [
  body("firstName")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("First name cannot be empty")
    .isLength({ max: 100 })
    .withMessage("First name must not exceed 100 characters"),

  body("lastName")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("Last name cannot be empty")
    .isLength({ max: 100 })
    .withMessage("Last name must not exceed 100 characters"),

  body("phone")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("Phone cannot be empty")
    .isLength({ max: 30 })
    .withMessage("Phone number must not exceed 30 characters"),

  body("email")
    .optional({ nullable: true, checkFalsy: true })
    .trim()
    .isEmail()
    .withMessage("A valid email address is required")
    .normalizeEmail(),

  body("img")
    .optional({ nullable: true, checkFalsy: true })
    .isURL()
    .withMessage("Image URL must be a valid URL"),

  body("roleId")
    .optional()
    .isUUID()
    .withMessage("Role ID must be a valid UUID"),

  body("storeId")
    .optional({ nullable: true })
    .isUUID()
    .withMessage("Store ID must be a valid UUID"),

  body("address")
    .optional({ nullable: true, checkFalsy: true })
    .trim()
    .isLength({ max: 500 })
    .withMessage("Address must not exceed 500 characters"),

  body("region")
    .optional({ nullable: true, checkFalsy: true })
    .trim()
    .isLength({ max: 100 })
    .withMessage("Region must not exceed 100 characters"),

  body("city")
    .optional({ nullable: true, checkFalsy: true })
    .trim()
    .isLength({ max: 100 })
    .withMessage("City must not exceed 100 characters"),
];

export const resetPasswordValidator = [
  body("newPassword")
    .isLength({ min: 8 })
    .withMessage("Password must be at least 8 characters")
    .matches(/[A-Z]/)
    .withMessage("Password must contain at least one uppercase letter")
    .matches(/[0-9]/)
    .withMessage("Password must contain at least one number"),

  body("currentPassword")
    .trim()
    .notEmpty()
    .withMessage("Current password is required"),
];

export const assignControlsValidator = [
  body("controlIds")
    .isArray({ min: 1 })
    .withMessage("controlIds must be a non-empty array")
    .custom((ids) => ids.every((id) => typeof id === "string"))
    .withMessage("Each control ID must be a string UUID"),
];

export const listUsersValidator = [
  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Page must be a positive integer"),

  query("limit")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("Limit must be between 1 and 100"),

  query("search")
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage("Search term must not exceed 100 characters"),

  query("storeId")
    .optional()
    .isUUID()
    .withMessage("storeId must be a valid UUID"),

  query("roleId")
    .optional()
    .isUUID()
    .withMessage("roleId must be a valid UUID"),

  query("isActive")
    .optional()
    .isBoolean()
    .withMessage("isActive must be true or false"),
];
