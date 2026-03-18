import { Router } from 'express';
import { listProducts, getProductById, createProduct, updateProduct, deleteProduct } from '../controllers/product.controller.js';
import { authenticate, authorize } from '../middlewares/auth.middleware.js';

const router = Router();
router.use(authenticate);

router.get('/',       listProducts);
router.get('/:id',    getProductById);
router.post('/',      authorize('admin', 'manager'), createProduct);
router.put('/:id',    authorize('admin', 'manager'), updateProduct);
router.delete('/:id', authorize('admin'),            deleteProduct);

export default router;
