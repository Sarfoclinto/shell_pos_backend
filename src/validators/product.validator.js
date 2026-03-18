import { body } from 'express-validator';

export const createProductValidator = [
  body('name').trim().notEmpty().withMessage('Product name is required'),
  body('sku').trim().notEmpty().withMessage('SKU is required'),
  body('price').isFloat({ min: 0 }).withMessage('Price must be a positive number'),
  body('tax_rate').optional().isFloat({ min: 0, max: 100 }).withMessage('Tax rate must be between 0 and 100'),
  body('unit').optional().trim(),
];

export const updateProductValidator = [
  body('name').optional().trim().notEmpty(),
  body('price').optional().isFloat({ min: 0 }),
  body('tax_rate').optional().isFloat({ min: 0, max: 100 }),
];
