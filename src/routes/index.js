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
import supplierRoutes from "./supplier.routes.js";
import purchaseOrderRoutes from "./purchaseOrder.routes.js";
import salesReturnRoutes from "./salesReturn.routes.js";
import inventoryAdjustmentRoutes from "./inventoryAdjustment.routes.js";
import stockTransferRoutes from "./stockTransfer.routes.js";
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
router.use("/customers", customerRoutes);
router.use("/sales", saleRoutes);
router.use("/suppliers", supplierRoutes);
router.use("/purchase-orders", purchaseOrderRoutes);
router.use("/sales-returns", salesReturnRoutes);
router.use("/inventory-adjustments", inventoryAdjustmentRoutes);
router.use("/stock-transfers", stockTransferRoutes);
router.use("/reports", reportRoutes);

export default router;
