import { dashboardRepository } from "../repositories/dashboard.repository.js";

// ── Shared serialisers ─────────────────────────────────────────────────────────

const pct = (current, previous) => {
  if (!previous || previous === 0) return current > 0 ? 100 : 0;
  return parseFloat((((current - previous) / previous) * 100).toFixed(2));
};

const serializeRecentSale = (row) => ({
  id: row.id,
  receiptNumber: row.receipt_number,
  finalAmount: parseFloat(row.final_amount),
  status: row.status,
  paymentMethod: row.payment_method ?? null,
  cashier: row.cashier_first
    ? { fullName: `${row.cashier_first} ${row.cashier_last}` }
    : undefined,
  store: row.store_name
    ? { name: row.store_name, code: row.store_code }
    : undefined,
  customer: row.customer_name ? { name: row.customer_name } : null,
  createdAt: row.created_at,
});

// ── Service ────────────────────────────────────────────────────────────────────

export const dashboardService = {
  // ── Admin / Manager ──────────────────────────────────────────────────────────

  async getAdminDashboard(storeId) {
    // Fire all queries in parallel — they are independent reads
    const [
      revenue,
      transactions,
      inventory,
      customers,
      users,
      suppliers,
      revenueByDay,
      salesByPaymentMethod,
      salesByStore,
      topProducts,
      recentSalesRaw,
      openShiftsRaw,
      alerts,
    ] = await Promise.all([
      dashboardRepository.adminRevenue(storeId),
      dashboardRepository.adminTransactions(storeId),
      dashboardRepository.adminInventory(storeId),
      dashboardRepository.adminCustomers(storeId),
      dashboardRepository.adminUsers(storeId),
      dashboardRepository.adminSuppliers(),
      dashboardRepository.adminRevenueByDay(storeId),
      dashboardRepository.adminSalesByPaymentMethod(storeId),
      dashboardRepository.adminSalesByStore(),
      dashboardRepository.adminTopProducts(storeId),
      dashboardRepository.adminRecentSales(storeId),
      dashboardRepository.adminOpenShifts(storeId),
      dashboardRepository.adminAlerts(storeId),
    ]);

    const thisMonth = parseFloat(revenue.this_month);
    const lastMonth = parseFloat(revenue.last_month);

    return {
      // ── KPI Cards ────────────────────────────────────────────────────────────
      revenue: {
        total: parseFloat(revenue.total),
        today: parseFloat(revenue.today),
        thisWeek: parseFloat(revenue.this_week),
        thisMonth,
        vsLastMonth: pct(thisMonth, lastMonth),
      },

      transactions: {
        total: parseInt(transactions.total, 10),
        today: parseInt(transactions.today, 10),
        completed: parseInt(transactions.completed, 10),
        pending: parseInt(transactions.pending, 10),
        cancelled: parseInt(transactions.cancelled, 10),
      },

      inventory: {
        totalSkus: parseInt(inventory.total_skus, 10),
        lowStockCount: parseInt(inventory.low_stock_count, 10),
        outOfStockCount: parseInt(inventory.out_of_stock_count, 10),
        totalStockValue: parseFloat(inventory.total_stock_value),
      },

      customers: {
        total: parseInt(customers.total, 10),
        newThisPeriod: parseInt(customers.new_this_period, 10),
      },

      users: {
        total: parseInt(users.total, 10),
        activeShifts: parseInt(users.active_shifts, 10),
      },

      suppliers: {
        total: parseInt(suppliers.total, 10),
        pendingOrders: parseInt(suppliers.pending_orders, 10),
      },

      // ── Time series ──────────────────────────────────────────────────────────
      revenueByDay: revenueByDay.map((r) => ({
        date: r.date,
        revenue: parseFloat(r.revenue),
        transactions: parseInt(r.transactions, 10),
      })),

      // ── Breakdowns ───────────────────────────────────────────────────────────
      salesByPaymentMethod: salesByPaymentMethod.map((r) => ({
        method: r.method,
        amount: parseFloat(r.amount),
        count: parseInt(r.count, 10),
      })),

      salesByStore: salesByStore.map((r) => ({
        storeId: r.store_id,
        storeName: r.store_name,
        storeCode: r.store_code,
        revenue: parseFloat(r.revenue),
        transactions: parseInt(r.transactions, 10),
      })),

      topProducts: topProducts.map((r) => ({
        productId: r.product_id,
        productName: r.product_name,
        sku: r.sku,
        revenue: parseFloat(r.revenue),
        quantitySold: parseInt(r.quantity_sold, 10),
      })),

      recentSales: recentSalesRaw.map(serializeRecentSale),

      // ── Operational alerts ───────────────────────────────────────────────────
      openShifts: openShiftsRaw.map((r) => ({
        id: r.id,
        openedAt: r.opened_at,
        cashier: { fullName: `${r.first_name} ${r.last_name}` },
        store: { name: r.store_name, code: r.store_code },
        completedTransactions: parseInt(r.completed_transactions, 10),
        totalRevenue: parseFloat(r.total_revenue),
      })),

      pendingAdjustments: parseInt(alerts.pending_adjustments, 10),
      pendingTransfers: parseInt(alerts.pending_transfers, 10),
      pendingPurchaseOrders: parseInt(alerts.pending_purchase_orders, 10),
      staleShifts: parseInt(alerts.stale_shifts, 10),
    };
  },

  // ── Cashier ───────────────────────────────────────────────────────────────────

  async getCashierDashboard(userId, storeId) {
    // Get current shift first — its ID is needed for shift-scoped queries
    const currentShiftRaw = await dashboardRepository.cashierCurrentShift(
      userId,
      storeId,
    );
    const shiftId = currentShiftRaw?.id ?? null;

    // Fire remaining queries in parallel
    const [
      todayStats,
      shiftRevenueByHour,
      recentSalesRaw,
      shiftPaymentBreakdown,
      allTimeStats,
    ] = await Promise.all([
      dashboardRepository.cashierTodayStats(userId),
      dashboardRepository.cashierShiftRevenueByHour(shiftId),
      dashboardRepository.cashierRecentSales(userId),
      dashboardRepository.cashierShiftPaymentBreakdown(shiftId),
      dashboardRepository.cashierAllTimeStats(userId),
    ]);

    return {
      // ── Current shift ─────────────────────────────────────────────────────────
      shift: currentShiftRaw
        ? {
            id: currentShiftRaw.id,
            openedAt: currentShiftRaw.opened_at,
            openingFloat: parseFloat(currentShiftRaw.opening_float),
            status: "open",
            duration: Math.floor(parseFloat(currentShiftRaw.duration_minutes)),
            completedTransactions: parseInt(
              currentShiftRaw.completed_transactions,
              10,
            ),
            totalRevenue: parseFloat(currentShiftRaw.total_revenue),
            expectedCash: parseFloat(currentShiftRaw.expected_cash),
            cashSales: parseFloat(currentShiftRaw.cash_sales),
            cardSales: parseFloat(currentShiftRaw.card_sales),
            momoSales: parseFloat(currentShiftRaw.momo_sales),
            splitSales: parseFloat(currentShiftRaw.split_sales),
          }
        : null,

      // ── Today's personal stats ────────────────────────────────────────────────
      today: {
        revenue: parseFloat(todayStats.revenue),
        transactions: parseInt(todayStats.transactions, 10),
        avgOrderValue: parseFloat(todayStats.avg_order_value),
        topPaymentMethod: todayStats.top_payment_method ?? null,
        completedCount: parseInt(todayStats.completed_count, 10),
        cancelledCount: parseInt(todayStats.cancelled_count, 10),
      },

      // ── Shift time series ─────────────────────────────────────────────────────
      shiftRevenueByHour: shiftRevenueByHour.map((r) => ({
        hour: r.hour,
        revenue: parseFloat(r.revenue),
        count: parseInt(r.count, 10),
      })),

      // ── Recent transactions ───────────────────────────────────────────────────
      recentSales: recentSalesRaw.map(serializeRecentSale),

      // ── Payment method breakdown for shift ────────────────────────────────────
      shiftPaymentBreakdown: shiftPaymentBreakdown.map((r) => ({
        method: r.method,
        amount: parseFloat(r.amount),
        count: parseInt(r.count, 10),
      })),

      // ── All-time personal stats ───────────────────────────────────────────────
      allTime: {
        totalRevenue: parseFloat(allTimeStats.total_revenue),
        totalTransactions: parseInt(allTimeStats.total_transactions, 10),
        shiftsCompleted: parseInt(allTimeStats.shifts_completed, 10),
      },
    };
  },
};

// ── Manager dashboard (appended) ──────────────────────────────────────────────
const _defaultFrom = () => {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
};
const _defaultTo = () => new Date().toISOString();
const _pct = (cur, prev) => {
  if (!prev || prev === 0) return cur > 0 ? 100 : 0;
  return parseFloat((((cur - prev) / prev) * 100).toFixed(2));
};

dashboardService.getManagerDashboard = async (storeId, from, to) => {
  const f = from || _defaultFrom();
  const t = to || _defaultTo();

  const [
    revenue,
    transactions,
    inventory,
    shifts,
    revenueByDay,
    salesByPaymentMethod,
    cashierSummary,
    lowStockAlerts,
    recentSalesRaw,
  ] = await Promise.all([
    dashboardRepository.managerRevenue(storeId),
    dashboardRepository.managerTransactions(storeId),
    dashboardRepository.managerInventory(storeId),
    dashboardRepository.managerShifts(storeId),
    dashboardRepository.managerRevenueByDay(storeId, f),
    dashboardRepository.managerSalesByPaymentMethod(storeId, f, t),
    dashboardRepository.managerCashierSummary(storeId, f, t),
    dashboardRepository.managerLowStockAlerts(storeId),
    dashboardRepository.managerRecentSales(storeId),
  ]);

  const thisMonth = parseFloat(revenue.this_month);
  const lastMonth = parseFloat(revenue.last_month);

  return {
    revenue: {
      total: parseFloat(revenue.total),
      today: parseFloat(revenue.today),
      thisWeek: parseFloat(revenue.this_week),
      thisMonth,
      vsLastPeriod: _pct(thisMonth, lastMonth),
      periodLabel: "vs last month",
    },
    transactions: {
      total: parseInt(transactions.total, 10),
      today: parseInt(transactions.today, 10),
      completed: parseInt(transactions.completed, 10),
      pending: parseInt(transactions.pending, 10),
      cancelled: parseInt(transactions.cancelled, 10),
    },
    inventory: {
      totalSkus: parseInt(inventory.total_skus, 10),
      lowStockCount: parseInt(inventory.low_stock_count, 10),
      outOfStockCount: parseInt(inventory.out_of_stock_count, 10),
    },
    shifts: {
      activeNow: parseInt(shifts.active_now, 10),
      staleCount: parseInt(shifts.stale_count, 10),
    },
    revenueByDay: revenueByDay.map((r) => ({
      date: r.date,
      revenue: parseFloat(r.revenue),
      transactions: parseInt(r.transactions, 10),
    })),
    salesByPaymentMethod: salesByPaymentMethod.map((r) => ({
      method: r.method,
      amount: parseFloat(r.amount),
      count: parseInt(r.count, 10),
    })),
    cashierSummary: cashierSummary.map((r) => ({
      userId: r.user_id,
      fullName: `${r.first_name} ${r.last_name}`,
      revenue: parseFloat(r.revenue),
      transactions: parseInt(r.transactions, 10),
      avgOrderValue: parseFloat(r.avg_order_value),
    })),
    lowStockAlerts: lowStockAlerts.map((r) => ({
      productId: r.product_id,
      productName: r.product_name,
      sku: r.sku,
      quantity: parseInt(r.quantity, 10),
      storeName: r.store_name,
      storeCode: r.store_code,
    })),
    recentSales: recentSalesRaw.map((row) => ({
      id: row.id,
      receiptNumber: row.receipt_number,
      finalAmount: parseFloat(row.final_amount),
      status: row.status,
      paymentMethod: row.payment_method ?? null,
      cashier: { fullName: `${row.cashier_first} ${row.cashier_last}` },
      store: { name: row.store_name, code: row.store_code },
      customer: row.customer_name ? { name: row.customer_name } : null,
      createdAt: row.created_at,
    })),
  };
};
