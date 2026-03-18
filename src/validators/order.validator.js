import { body } from 'express-validator';

export const createOrderValidator = [
  body('items').isArray({ min: 1 }).withMessage('Order must have at least one item'),
  body('items.*.product_id').isUUID().withMessage('Each item must have a valid product_id'),
  body('items.*.quantity').isInt({ min: 1 }).withMessage('Item quantity must be at least 1'),
  body('items.*.unit_price').isFloat({ min: 0 }).withMessage('Item unit_price must be positive'),
  body('payment.method').isIn(['cash', 'card', 'mobile_money', 'bank_transfer', 'other'])
    .withMessage('Valid payment method required'),
  body('payment.amount').isFloat({ min: 0.01 }).withMessage('Payment amount must be positive'),
];
