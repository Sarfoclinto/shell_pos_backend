import { body } from "express-validator";

export const loginValidator = [
  body("emailOrPhone")
    .trim()
    .notEmpty()
    .withMessage("Email or phone number is required"),

  body("password").notEmpty().withMessage("Password is required"),
];

export const refreshValidator = [
  body("refreshToken")
    .trim()
    .notEmpty()
    .withMessage("Refresh token is required"),
];

export const changePasswordValidator = [
  body("currentPassword")
    .notEmpty()
    .withMessage("Current password is required"),

  body("newPassword")
    .isLength({ min: 8 })
    .withMessage("New password must be at least 8 characters")
    .matches(/[A-Z]/)
    .withMessage("New password must contain at least one uppercase letter")
    .matches(/[0-9]/)
    .withMessage("New password must contain at least one number"),

  body("confirmPassword")
    .custom((value, { req }) => value === req.body.newPassword)
    .withMessage("Passwords do not match"),
];
