import { Router } from "express";
import authRoutes from "./auth.routes.js";
import storeRoutes from "./store.routes.js";
import userRoutes from "./user.routes.js";
import roleRoutes from "./role.routes.js";
import shiftRoutes from "./shift.route.js";
import categoryRoutes from "./category.route.js";
import productRoutes from "./product.routes.js";

// TODO: update routes for orders, customers, inventory, reports, etc.
import orderRoutes from "./order.routes.js";
import customerRoutes from "./customer.routes.js";
import inventoryRoutes from "./inventory.routes.js";
import reportRoutes from "./report.routes.js";

const router = Router();

// done
router.use("/auth", authRoutes);
router.use("/stores", storeRoutes);
router.use("/roles", roleRoutes);
router.use("/users", userRoutes);
router.use("/shifts", shiftRoutes);
router.use("/categories", categoryRoutes);
router.use("/products", productRoutes);

// todo
router.use("/orders", orderRoutes);
router.use("/customers", customerRoutes);
router.use("/inventory", inventoryRoutes);
router.use("/reports", reportRoutes);

export default router;
