import { shiftRepository } from "../repositories/shift.repository.js";
import { ApiError } from "../utils/api-error.js";
import { paginate } from "../utils/pagination.js";

// ── Serialisers ───────────────────────────────────────────────────────────────

const serializeList = (row) => ({
  id: row.id,
  status: row.status,
  openedAt: row.opened_at,
  closedAt: row.closed_at ?? null,
  openingFloat: parseFloat(row.opening_float),
  closingCash: row.closing_cash !== null ? parseFloat(row.closing_cash) : null,
  expectedCash:
    row.expected_cash !== null ? parseFloat(row.expected_cash) : null,
  difference: row.difference !== null ? parseFloat(row.difference) : null,
  completedTransactions: parseInt(row.completed_transactions ?? 0, 10),
  totalRevenue: parseFloat(row.total_revenue ?? 0),
  cashier: {
    id: row.user_id,
    firstName: row.first_name,
    lastName: row.last_name,
    fullName: `${row.first_name} ${row.last_name}`,
  },
  store: {
    id: row.store_id,
    name: row.store_name,
    code: row.store_code,
  },
  createdAt: row.created_at,
});

const serializeDetail = (row) => ({
  ...serializeList(row),
  // Override with full transaction counts from detail query
  completedTransactions: parseInt(row.completed_transactions ?? 0, 10),
  cancelledTransactions: parseInt(row.cancelled_transactions ?? 0, 10),
  totalTransactions: parseInt(row.total_transactions ?? 0, 10),
  totalRevenue: parseFloat(row.total_revenue ?? 0),
  totalDiscounts: parseFloat(row.total_discounts ?? 0),
  totalTax: parseFloat(row.total_tax ?? 0),
  paymentBreakdown: {
    cash: parseFloat(row.cash_collected ?? 0),
    card: parseFloat(row.card_collected ?? 0),
    mobileMoney: parseFloat(row.mobile_money_collected ?? 0),
    split: parseFloat(row.split_collected ?? 0),
    other: parseFloat(row.other_collected ?? 0),
  },
});

// ── Service ───────────────────────────────────────────────────────────────────

export const shiftService = {
  /**
   * Open a new shift for the authenticated cashier at their assigned store.
   */
  async open(userId, storeId, openingFloat, openedAt = null) {
    if (!storeId) {
      throw ApiError.badRequest(
        "You are not assigned to a store. Ask an admin to assign you to a store first.",
      );
    }

    const existing = await shiftRepository.findOpenShift(userId, storeId);
    if (existing) {
      throw ApiError.conflict(
        "You already have an open shift. Close it before opening a new one.",
      );
    }

    const shift = await shiftRepository.openShift(
      userId,
      storeId,
      openingFloat,
      userId,
      openedAt,
    );
    return shiftRepository.findByIdWithSummary(shift.id).then(serializeDetail);
  },

  /**
   * Close the caller's current open shift.
   * Calculates expected cash and variance automatically.
   */
  async close(userId, storeId, closingCash, notes) {
    if (!storeId) {
      throw ApiError.badRequest("You are not assigned to a store.");
    }

    const openShift = await shiftRepository.findOpenShift(userId, storeId);
    if (!openShift) {
      throw ApiError.notFound("You do not have an open shift to close.");
    }

    await shiftRepository.closeShift(openShift.id, closingCash, userId, notes);
    const closed = await shiftRepository.findByIdWithSummary(openShift.id);
    return serializeDetail(closed);
  },

  /**
   * Admin close shift
   * @param {string} adminId - The ID of the admin closing the shift
   * @param {string} cashierId - The ID of the cashier whose shift is being closed
   * @param {string} storeId - The ID of the store
   * @param {number} closingCash - The amount of cash in the drawer
   * @param {string} notes - Any notes about the shift
   */
  async adminClose(adminId, cashierId, storeId, closingCash, notes) {
    if (!storeId) {
      throw ApiError.badRequest("Store not found");
    }

    const openShift = await shiftRepository.findOpenShift(cashierId, storeId);
    if (!openShift) {
      throw ApiError.notFound("Cashier does not have an open shift to close.");
    }

    await shiftRepository.adminCloseShift(
      openShift.id,
      closingCash,
      adminId,
      notes,
    );
    const closed = await shiftRepository.findByIdWithSummary(openShift.id);
    return serializeDetail(closed);
  },

  /**
   * Get the caller's currently open shift.
   */
  async getCurrent(userId, storeId) {
    if (!storeId) {
      throw ApiError.badRequest("You are not assigned to a store.");
    }

    const shift = await shiftRepository.findOpenShift(userId, storeId);
    if (!shift) {
      throw ApiError.notFound("You do not have an open shift.");
    }

    const detail = await shiftRepository.findByIdWithSummary(shift.id);
    return serializeDetail(detail);
  },

  /**
   * Get a single shift by ID (admin/manager use).
   */
  async getById(id) {
    const shift = await shiftRepository.findByIdWithSummary(id);
    if (!shift) throw ApiError.notFound("Shift not found");
    return serializeDetail(shift);
  },

  /**
   * Paginated list with optional filters.
   */
  async list(queryParams) {
    const { page, limit, offset } = paginate(queryParams);

    const { rows, total } = await shiftRepository.findAll({
      storeId: queryParams.storeId || undefined,
      userId: queryParams.userId || undefined,
      status: queryParams.status || undefined,
      from: queryParams.from || undefined,
      to: queryParams.to || undefined,
      limit,
      offset,
    });

    return {
      shifts: rows.map(serializeList),
      pagination: { page, limit, total },
    };
  },
};
