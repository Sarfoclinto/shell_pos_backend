import { body } from 'express-validator';

export const createCustomerValidator = [
  body('name').trim().notEmpty().withMessage('Customer name is required'),
  body('email').optional().isEmail().normalizeEmail().withMessage('Valid email required'),
  body('phone').optional().trim(),
];
