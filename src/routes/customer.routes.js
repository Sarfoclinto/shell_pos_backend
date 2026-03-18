import { Router } from 'express';
import { listCustomers, getCustomerById, createCustomer, updateCustomer, deleteCustomer } from '../controllers/customer.controller.js';
import { authenticate, authorize } from '../middlewares/auth.middleware.js';

const router = Router();
router.use(authenticate);

router.get('/',       listCustomers);
router.get('/:id',    getCustomerById);
router.post('/',      createCustomer);
router.put('/:id',    updateCustomer);
router.delete('/:id', authorize('admin', 'manager'), deleteCustomer);

export default router;
