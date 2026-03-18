import { Router } from 'express';
import { listOrders, getOrderById, createOrder, cancelOrder } from '../controllers/order.controller.js';
import { authenticate, authorize } from '../middlewares/auth.middleware.js';

const router = Router();
router.use(authenticate);

router.get('/',            listOrders);
router.get('/:id',         getOrderById);
router.post('/',           createOrder);
router.patch('/:id/cancel', authorize('admin', 'manager'), cancelOrder);

export default router;
