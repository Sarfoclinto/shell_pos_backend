import { Router } from "express";
import authRoutes from "./auth.routes.js";
import storeRoutes from "./store.routes.js";
import userRoutes from "./user.routes.js";
import roleRoutes from "./role.routes.js";
import shiftRoutes from "./shift.routes.js";
import categoryRoutes from "./category.routes.js";
import productRoutes from "./product.routes.js";
import customerRoutes from "./customer.routes.js";
import saleRoutes from "./sale.routes.js";


const router = Router();

// done
router.use("/auth", authRoutes);
router.use("/stores", storeRoutes);
router.use("/roles", roleRoutes);
router.use("/users", userRoutes);
router.use("/shifts", shiftRoutes);
router.use("/categories", categoryRoutes);
router.use("/products", productRoutes);
router.use("/customers", customerRoutes);
router.use("/sales", saleRoutes);

export default router;
