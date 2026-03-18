import { Router } from 'express';
import { salesSummary, topProducts, dailySales } from '../controllers/report.controller.js';
import { authenticate, authorize } from '../middlewares/auth.middleware.js';

const router = Router();
router.use(authenticate, authorize('admin', 'manager'));

router.get('/sales-summary', salesSummary);
router.get('/top-products',  topProducts);
router.get('/daily-sales',   dailySales);

export default router;
