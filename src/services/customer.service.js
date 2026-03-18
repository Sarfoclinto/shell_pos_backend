import { customerRepository } from "../repositories/customer.repository.js";
import { ApiError } from "../utils/api-error.js";
import { paginate } from "../utils/pagination.js";

// ── Serialisers ───────────────────────────────────────────────────────────────

const serializeBase = (row) => ({
  id: row.id,
  name: row.name,
  phone: row.phone,
  email: row.email ?? null,
  address: row.address ?? null,
  region: row.region ?? null,
  city: row.city ?? null,
  loyaltyPoints: row.loyalty_points,
  createdAt: row.created_at,
  updatedAt: row.updated_at ?? null,
});

const serializeDetail = (row) => ({
  ...serializeBase(row),
  stats: {
    totalTransactions: parseInt(row.stats?.total_transactions ?? 0, 10),
    lifetimeSpend: parseFloat(row.stats?.lifetime_spend ?? 0),
    lastPurchaseAt: row.stats?.last_purchase_at ?? null,
  },
  recentSales: (row.recentSales ?? []).map((s) => ({
    id: s.id,
    receiptNumber: s.receipt_number,
    finalAmount: parseFloat(s.final_amount),
    status: s.status,
    storeName: s.store_name,
    createdAt: s.created_at,
  })),
});

// ── Service ───────────────────────────────────────────────────────────────────

export const customerService = {
  async list(queryParams) {
    const { page, limit, offset } = paginate(queryParams);

    const { rows, total } = await customerRepository.findAll({
      search: queryParams.search?.trim() || undefined,
      limit,
      offset,
    });

    return {
      customers: rows.map(serializeBase),
      pagination: { page, limit, total },
    };
  },

  async getById(id) {
    const customer = await customerRepository.findByIdWithHistory(id);
    if (!customer) throw ApiError.notFound("Customer not found");
    return serializeDetail(customer);
  },

  async getByPhone(phone) {
    const customer = await customerRepository.findByPhone(phone);
    if (!customer)
      throw ApiError.notFound(`No customer found with phone "${phone}"`);
    // Return full detail so the POS screen has all the info it needs
    const detail = await customerRepository.findByIdWithHistory(customer.id);
    return serializeDetail(detail);
  },

  async create(data, createdBy) {
    const phoneConflict = await customerRepository.findByPhone(data.phone);
    if (phoneConflict) {
      throw ApiError.conflict(
        "A customer with this phone number already exists",
      );
    }

    if (data.email) {
      const emailConflict = await customerRepository.findByEmail(data.email);
      if (emailConflict) {
        throw ApiError.conflict("A customer with this email already exists");
      }
    }

    const customer = await customerRepository.create(data, createdBy);
    return serializeBase(customer);
  },

  async update(id, data, updatedBy) {
    const customer = await customerRepository.findByIdWithHistory(id);
    if (!customer) throw ApiError.notFound("Customer not found");

    if (data.phone && data.phone !== customer.phone) {
      const conflict = await customerRepository.findByPhone(data.phone, id);
      if (conflict)
        throw ApiError.conflict(
          "A customer with this phone number already exists",
        );
    }

    if (data.email && data.email !== customer.email) {
      const conflict = await customerRepository.findByEmail(data.email, id);
      if (conflict)
        throw ApiError.conflict("A customer with this email already exists");
    }

    const updated = await customerRepository.update(id, data, updatedBy);
    return serializeDetail(updated);
  },

  async remove(id, deletedBy) {
    const customer = await customerRepository.findByIdWithHistory(id);
    if (!customer) throw ApiError.notFound("Customer not found");
    await customerRepository.softDelete(id, deletedBy);
  },
};
