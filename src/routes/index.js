import { Router } from "express";
import authRoutes from "./auth.routes.js";
import storeRoutes from "./store.routes.js";
import userRoutes from "./user.routes.js";
import roleRoutes from "./role.routes.js";

// TODO: Add routes for products, orders, customers, inventory, reports, etc.
import productRoutes from "./product.routes.js";
import orderRoutes from "./order.routes.js";
import customerRoutes from "./customer.routes.js";
import inventoryRoutes from "./inventory.routes.js";
import reportRoutes from "./report.routes.js";
// import categoryRoutes  from './category.routes.js';

const router = Router();

// done
router.use("/auth", authRoutes);
router.use("/stores", storeRoutes);
router.use("/users", userRoutes);
router.use("/roles", roleRoutes);

// not done
router.use("/products", productRoutes);
router.use("/orders", orderRoutes);
router.use("/customers", customerRoutes);
router.use("/inventory", inventoryRoutes);
router.use("/reports", reportRoutes);

export default router;
