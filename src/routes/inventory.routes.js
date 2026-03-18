import { Router } from 'express';
import { getInventory, adjustStock, getLowStock, setThresholds } from '../controllers/inventory.controller.js';
import { authenticate, authorize } from '../middlewares/auth.middleware.js';

const router = Router();
router.use(authenticate);

router.get('/low-stock',                         getLowStock);
router.get('/:productId',                        getInventory);
router.patch('/:productId/adjust',  authorize('admin', 'manager'), adjustStock);
router.patch('/:productId/thresholds', authorize('admin', 'manager'), setThresholds);

export default router;
