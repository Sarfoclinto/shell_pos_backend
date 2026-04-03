import { report1Repository } from "../repositories/report1.repository.js";
import { paginate } from "../utils/pagination.js";

const defaultFrom = () => {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
};
const defaultTo = () => new Date().toISOString();

export const report1Service = {
  // ── Sales Report ────────────────────────────────────────────────────────────

  async salesReport(queryParams) {
    const { page, limit, offset } = paginate(queryParams);
    const p = {
      storeId: queryParams.storeId || undefined,
      userId: queryParams.userId || undefined,
      status: queryParams.status || undefined,
      paymentMethod: queryParams.paymentMethod || undefined,
      from: queryParams.from || defaultFrom(),
      to: queryParams.to || defaultTo(),
    };

    const [summary, revenueByDay, byPaymentMethod, salesData] =
      await Promise.all([
        report1Repository.salesSummary(p),
        report1Repository.salesRevenueByDay(p),
        report1Repository.salesByPaymentMethod(p),
        report1Repository.salesList({ ...p, limit, offset }),
      ]);

    return {
      summary: {
        totalRevenue: parseFloat(summary.total_revenue),
        totalTransactions: parseInt(summary.total_transactions, 10),
        completedRevenue: parseFloat(summary.completed_revenue),
        cancelledCount: parseInt(summary.cancelled_count, 10),
        avgOrderValue: parseFloat(summary.avg_order_value),
        totalDiscount: parseFloat(summary.total_discount),
        totalTax: parseFloat(summary.total_tax),
        cashRevenue: parseFloat(summary.cash_revenue),
        cardRevenue: parseFloat(summary.card_revenue),
        momoRevenue: parseFloat(summary.momo_revenue),
        splitRevenue: parseFloat(summary.split_revenue),
      },
      revenueByDay: revenueByDay.map((r) => ({
        date: r.date,
        revenue: parseFloat(r.revenue),
        transactions: parseInt(r.transactions, 10),
      })),
      byPaymentMethod: byPaymentMethod.map((r) => ({
        method: r.method,
        amount: parseFloat(r.amount),
        count: parseInt(r.count, 10),
      })),
      sales: salesData.rows.map((row) => ({
        id: row.id,
        receiptNumber: row.receipt_number,
        finalAmount: parseFloat(row.final_amount),
        discountAmount: parseFloat(row.discount_amount),
        taxAmount: parseFloat(row.tax_amount),
        status: row.status,
        paymentMethod: row.payment_method ?? null,
        cashier: { fullName: `${row.first_name} ${row.last_name}` },
        store: { name: row.store_name, code: row.store_code },
        customer: row.customer_name
          ? { name: row.customer_name, phone: row.customer_phone }
          : null,
        createdAt: row.created_at,
      })),
      pagination: { page, limit, total: salesData.total },
    };
  },

  // ── Inventory Report ────────────────────────────────────────────────────────

  async inventoryReport(queryParams) {
    const { page, limit, offset } = paginate(queryParams);
    const p = {
      storeId: queryParams.storeId || undefined,
      categoryId: queryParams.categoryId || undefined,
      lowStock: queryParams.lowStock,
      type: queryParams.type || undefined,
    };

    const [summary, itemsData, byCategory] = await Promise.all([
      report1Repository.inventorySummary(p),
      report1Repository.inventoryItems({ ...p, limit, offset }),
      report1Repository.inventoryByCategory(p),
    ]);

    return {
      summary: {
        totalSkus: parseInt(summary.total_skus, 10),
        totalUnits: parseInt(summary.total_units, 10),
        totalStockValue: parseFloat(summary.total_stock_value),
        lowStockCount: parseInt(summary.low_stock_count, 10),
        outOfStockCount: parseInt(summary.out_of_stock_count, 10),
        inventoryTypeCount: parseInt(summary.inventory_type_count, 10),
        nonInventoryCount: parseInt(summary.non_inventory_count, 10),
      },
      items: itemsData.rows.map((row) => ({
        productId: row.product_id,
        productName: row.product_name,
        sku: row.sku,
        barcode: row.barcode ?? null,
        type: row.type,
        categoryName: row.category_name ?? null,
        variation: row.variation ?? null,
        quantity: parseInt(row.quantity, 10),
        costPrice: row.cost_price ? parseFloat(row.cost_price) : null,
        stockValue: row.cost_price
          ? parseFloat(row.cost_price) * parseInt(row.quantity, 10)
          : null,
        lastUpdated: row.last_updated ?? null,
        store: row.store_id
          ? {
              id: row.store_id,
              name: row.store_name,
              code: row.store_code,
            }
          : null,
      })),
      pagination: { page, limit, total: itemsData.total },
      byCategory: byCategory.map((r) => ({
        categoryName: r.category_name,
        totalUnits: parseInt(r.total_units, 10),
        totalValue: parseFloat(r.total_value),
        skuCount: parseInt(r.sku_count, 10),
      })),
    };
  },

  // ── Cashier Report ──────────────────────────────────────────────────────────

  async cashierReport(queryParams) {
    const p = {
      storeId: queryParams.storeId || undefined,
      userId: queryParams.userId || undefined,
      from: queryParams.from || defaultFrom(),
      to: queryParams.to || defaultTo(),
    };

    const [cashiers, paymentBreakdowns, dailyRaw] = await Promise.all([
      report1Repository.cashierStats(p),
      report1Repository.cashierPaymentBreakdown(p),
      report1Repository.cashierDailyByUser(p),
    ]);

    // Group payment breakdowns by userId
    const paymentByUser = paymentBreakdowns.reduce((acc, row) => {
      if (!acc[row.user_id]) acc[row.user_id] = [];
      acc[row.user_id].push({
        method: row.method,
        amount: parseFloat(row.amount),
        count: parseInt(row.count, 10),
      });
      return acc;
    }, {});

    // Build dailyByUser: [{ date, userId1: revenue, userId2: revenue }]
    const dailyMap = {};
    for (const row of dailyRaw) {
      const d = String(row.date);
      if (!dailyMap[d]) dailyMap[d] = { date: d };
      dailyMap[d][row.user_id] = parseFloat(row.revenue);
    }
    const dailyByUser = Object.values(dailyMap).sort((a, b) =>
      a.date.localeCompare(b.date),
    );

    return {
      cashiers: cashiers.map((r) => ({
        userId: r.user_id,
        firstName: r.first_name,
        lastName: r.last_name,
        fullName: `${r.first_name} ${r.last_name}`,
        revenue: parseFloat(r.revenue),
        transactions: parseInt(r.transactions, 10),
        completedTransactions: parseInt(r.completed_transactions, 10),
        cancelledTransactions: parseInt(r.cancelled_transactions, 10),
        avgOrderValue: parseFloat(r.avg_order_value),
        shiftsWorked: parseInt(r.shifts_worked, 10),
        totalShiftHours: parseFloat(r.total_shift_hours),
        avgRevenuePerShift:
          r.shifts_worked > 0
            ? parseFloat((r.revenue / r.shifts_worked).toFixed(2))
            : 0,
        paymentMethodBreakdown: paymentByUser[r.user_id] ?? [],
        lastActiveAt: r.last_active_at ?? null,
      })),
      dailyByUser,
      period: { from: p.from, to: p.to },
    };
  },

  // ── Product Report ──────────────────────────────────────────────────────────

  async productReport(queryParams) {
    const { page, limit, offset } = paginate(queryParams);
    const p = {
      storeId: queryParams.storeId || undefined,
      categoryId: queryParams.categoryId || undefined,
      from: queryParams.from || defaultFrom(),
      to: queryParams.to || defaultTo(),
      sort: queryParams.sort || "revenue_desc",
    };

    const [summary, productsData, byCategory] = await Promise.all([
      report1Repository.productSummary(p),
      report1Repository.productList({ ...p, limit, offset }),
      report1Repository.productByCategory(p),
    ]);

    return {
      summary: {
        totalProductsSold: parseInt(summary.total_products_sold, 10),
        totalUnitsSold: parseInt(summary.total_units_sold, 10),
        totalRevenue: parseFloat(summary.total_revenue),
        avgRevenuePerProduct: parseFloat(summary.avg_revenue_per_product),
      },
      products: productsData.rows.map((r) => ({
        productId: r.product_id,
        productName: r.product_name,
        sku: r.sku,
        categoryName: r.category_name ?? null,
        variation: r.variation ?? null,
        revenue: parseFloat(r.revenue),
        unitsSold: parseInt(r.units_sold, 10),
        transactions: parseInt(r.transactions, 10),
        avgUnitPrice: parseFloat(r.avg_unit_price),
        currentStock:
          r.current_stock !== null ? parseInt(r.current_stock, 10) : null,
      })),
      pagination: { page, limit, total: productsData.total },
      byCategory: byCategory.map((r) => ({
        categoryName: r.category_name,
        revenue: parseFloat(r.revenue),
        unitsSold: parseInt(r.units_sold, 10),
        productCount: parseInt(r.product_count, 10),
      })),
    };
  },
};
