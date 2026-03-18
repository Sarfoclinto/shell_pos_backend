import { reportRepository } from "../repositories/report.repository.js";
import { paginate } from "../utils/pagination.js";

// ── Serialisers ───────────────────────────────────────────────────────────────

const serializeSalesSummary = (row, from, to) => ({
  period: { from, to },
  totalOrders: parseInt(row.total_orders, 10),
  grossRevenue: parseFloat(row.gross_revenue),
  totalDiscounts: parseFloat(row.total_discounts),
  totalTax: parseFloat(row.total_tax),
  netRevenue: parseFloat(row.net_revenue),
  avgOrderValue: parseFloat(row.avg_order_value),
  uniqueCustomers: parseInt(row.unique_customers, 10),
  activeCashiers: parseInt(row.active_cashiers, 10),
});

const serializeDayRow = (row) => ({
  date: row.date,
  totalOrders: parseInt(row.total_orders, 10),
  netRevenue: parseFloat(row.net_revenue),
  totalDiscounts: parseFloat(row.total_discounts),
});

const serializePaymentMethod = (row) => ({
  method: row.method,
  transactionCount: parseInt(row.transaction_count, 10),
  totalAmount: parseFloat(row.total_amount),
});

const serializeTopProduct = (row) => ({
  productId: row.product_id,
  productName: row.product_name,
  sku: row.sku,
  categoryName: row.category_name ?? null,
  totalQtySold: parseInt(row.total_qty_sold, 10),
  totalRevenue: parseFloat(row.total_revenue),
  orderCount: parseInt(row.order_count, 10),
});

const serializeTopCustomer = (row) => ({
  customerId: row.customer_id,
  customerName: row.customer_name,
  phone: row.phone,
  loyaltyPoints: row.loyalty_points,
  totalOrders: parseInt(row.total_orders, 10),
  lifetimeSpend: parseFloat(row.lifetime_spend),
  lastPurchaseAt: row.last_purchase_at,
});

const serializeStockLevel = (row) => ({
  productId: row.product_id,
  productName: row.product_name,
  sku: row.sku,
  type: row.type,
  categoryName: row.category_name ?? null,
  variation: row.variation ?? null,
  totalQuantity: parseInt(row.total_quantity, 10),
  stockByStore: (typeof row.stock_by_store === "string"
    ? JSON.parse(row.stock_by_store)
    : (row.stock_by_store ?? [])
  ).map((s) => ({
    storeId: s.storeId,
    storeName: s.storeName,
    storeCode: s.storeCode,
    quantity: parseInt(s.quantity, 10),
  })),
});

const serializeLowStockRow = (row) => ({
  productId: row.product_id,
  productName: row.product_name,
  sku: row.sku,
  categoryName: row.category_name ?? null,
  storeId: row.store_id,
  storeName: row.store_name,
  storeCode: row.store_code,
  currentQuantity: parseInt(row.current_quantity, 10),
  reorderLevel: parseInt(row.reorder_level, 10),
  deficit: Math.max(
    0,
    parseInt(row.reorder_level, 10) - parseInt(row.current_quantity, 10),
  ),
});

const serializeMovement = (row) => ({
  id: row.id,
  movementType: row.movement_type,
  quantityChange: parseInt(row.quantity_change, 10),
  referenceType: row.reference_type,
  referenceId: row.reference_id,
  note: row.note ?? null,
  createdAt: row.created_at,
  product: { name: row.product_name, sku: row.product_sku },
  store: { name: row.store_name, code: row.store_code },
  performedBy: row.first_name
    ? {
        firstName: row.first_name,
        lastName: row.last_name,
        fullName: `${row.first_name} ${row.last_name}`,
      }
    : null,
});

const serializeShift = (row) => ({
  id: row.id,
  status: row.status,
  openedAt: row.opened_at,
  closedAt: row.closed_at ?? null,
  openingFloat: parseFloat(row.opening_float),
  closingCash: row.closing_cash !== null ? parseFloat(row.closing_cash) : null,
  expectedCash:
    row.expected_cash !== null ? parseFloat(row.expected_cash) : null,
  difference: row.difference !== null ? parseFloat(row.difference) : null,
  completedSales: parseInt(row.completed_sales, 10),
  shiftRevenue: parseFloat(row.shift_revenue),
  cashier: {
    firstName: row.first_name,
    lastName: row.last_name,
    fullName: `${row.first_name} ${row.last_name}`,
  },
  store: { name: row.store_name, code: row.store_code },
});

const serializeShiftSummary = (summary) => ({
  totalShifts: parseInt(summary.total_shifts, 10),
  openShifts: parseInt(summary.open_shifts, 10),
  closedShifts: parseInt(summary.closed_shifts, 10),
  totalOpeningFloat: parseFloat(summary.total_opening_float),
  totalClosingCash: parseFloat(summary.total_closing_cash),
  totalExpectedCash: parseFloat(summary.total_expected_cash),
  totalDifference: parseFloat(summary.total_difference),
});

const serializePOSummary = (summary) => ({
  totalOrders: parseInt(summary.total_orders, 10),
  pending: parseInt(summary.pending, 10),
  ordered: parseInt(summary.ordered, 10),
  received: parseInt(summary.received, 10),
  cancelled: parseInt(summary.cancelled, 10),
  totalSpend: parseFloat(summary.total_spend),
});

const serializePOBySupplier = (row) => ({
  supplierId: row.supplier_id,
  supplierName: row.supplier_name,
  orderCount: parseInt(row.order_count, 10),
  totalSpend: parseFloat(row.total_spend),
});

// ── Service ───────────────────────────────────────────────────────────────────

export const reportService = {
  async salesSummary(queryParams) {
    const data = await reportRepository.salesSummary({
      from: queryParams.from || undefined,
      to: queryParams.to || undefined,
      storeId: queryParams.storeId || undefined,
    });
    return serializeSalesSummary(data, data.from, data.to);
  },

  async salesByDay(queryParams) {
    const rows = await reportRepository.salesByDay({
      from: queryParams.from || undefined,
      to: queryParams.to || undefined,
      storeId: queryParams.storeId || undefined,
    });
    return rows.map(serializeDayRow);
  },

  async salesByPaymentMethod(queryParams) {
    const rows = await reportRepository.salesByPaymentMethod({
      from: queryParams.from || undefined,
      to: queryParams.to || undefined,
      storeId: queryParams.storeId || undefined,
    });
    return rows.map(serializePaymentMethod);
  },

  async topProducts(queryParams) {
    const rows = await reportRepository.topProducts({
      from: queryParams.from || undefined,
      to: queryParams.to || undefined,
      storeId: queryParams.storeId || undefined,
      limit: queryParams.limit ? parseInt(queryParams.limit, 10) : 10,
    });
    return rows.map(serializeTopProduct);
  },

  async topCustomers(queryParams) {
    const rows = await reportRepository.topCustomers({
      from: queryParams.from || undefined,
      to: queryParams.to || undefined,
      storeId: queryParams.storeId || undefined,
      limit: queryParams.limit ? parseInt(queryParams.limit, 10) : 10,
    });
    return rows.map(serializeTopCustomer);
  },

  async stockLevels(queryParams) {
    const { page, limit, offset } = paginate(queryParams);
    const { rows, total } = await reportRepository.stockLevels({
      storeId: queryParams.storeId || undefined,
      categoryId: queryParams.categoryId || undefined,
      limit,
      offset,
    });
    return {
      stockLevels: rows.map(serializeStockLevel),
      pagination: { page, limit, total },
    };
  },

  async lowStock(queryParams) {
    const rows = await reportRepository.lowStock({
      storeId: queryParams.storeId || undefined,
    });
    return rows.map(serializeLowStockRow);
  },

  async stockMovementLog(queryParams) {
    const { page, limit, offset } = paginate(queryParams);
    const { rows, total } = await reportRepository.stockMovementLog({
      storeId: queryParams.storeId || undefined,
      productId: queryParams.productId || undefined,
      movementType: queryParams.movementType || undefined,
      from: queryParams.from || undefined,
      to: queryParams.to || undefined,
      limit,
      offset,
    });
    return {
      movements: rows.map(serializeMovement),
      pagination: { page, limit, total },
    };
  },

  async shiftSummary(queryParams) {
    const { summary, shifts } = await reportRepository.shiftSummary({
      storeId: queryParams.storeId || undefined,
      userId: queryParams.userId || undefined,
      from: queryParams.from || undefined,
      to: queryParams.to || undefined,
    });
    return {
      summary: serializeShiftSummary(summary),
      shifts: shifts.map(serializeShift),
    };
  },

  async purchaseOrdersSummary(queryParams) {
    const { summary, bySupplier } =
      await reportRepository.purchaseOrdersSummary({
        storeId: queryParams.storeId || undefined,
        supplierId: queryParams.supplierId || undefined,
        from: queryParams.from || undefined,
        to: queryParams.to || undefined,
      });
    return {
      summary: serializePOSummary(summary),
      bySupplier: bySupplier.map(serializePOBySupplier),
    };
  },
};
