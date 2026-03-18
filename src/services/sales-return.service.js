import { salesReturnRepository } from "../repositories/sales-return.repository.js";
import { ApiError } from "../utils/api-error.js";
import { paginate } from "../utils/pagination.js";
import { withTransaction } from "../config/database.js";
import { query } from "../config/database.js";

const serializeList = (row) => ({
  id: row.id,
  returnNumber: row.return_number,
  status: row.status,
  totalAmount: parseFloat(row.total_amount),
  reason: row.reason ?? null,
  receiptNumber: row.receipt_number,
  store: { name: row.store_name },
  cashier: { firstName: row.first_name, lastName: row.last_name },
  customer: row.customer_name ? { name: row.customer_name } : null,
  createdAt: row.created_at,
});

const serializeDetail = (row) => {
  const items =
    typeof row.items === "string" ? JSON.parse(row.items) : (row.items ?? []);
  return {
    ...serializeList(row),
    customerPhone: row.customer_phone ?? null,
    saleId: row.sale_id,
    items: items.map((i) => ({
      id: i.id,
      productId: i.productId,
      productName: i.productName,
      sku: i.sku,
      quantity: i.quantity,
      unitPrice: parseFloat(i.unitPrice),
      totalPrice: parseFloat(i.totalPrice),
    })),
  };
};

export const salesReturnService = {
  async list(queryParams) {
    const { page, limit, offset } = paginate(queryParams);
    const { rows, total } = await salesReturnRepository.findAll({
      storeId: queryParams.storeId || undefined,
      status: queryParams.status || undefined,
      from: queryParams.from || undefined,
      to: queryParams.to || undefined,
      limit,
      offset,
    });
    return {
      returns: rows.map(serializeList),
      pagination: { page, limit, total },
    };
  },

  async getById(id) {
    const r = await salesReturnRepository.findByIdWithItems(id);
    if (!r) throw ApiError.notFound("Sales return not found");
    return serializeDetail(r);
  },

  async create(data, storeId, userId, createdBy) {
    // Validate original sale exists and belongs to this store
    const { rows: saleRows } = await query(
      `SELECT id, store_id, status, customer_id FROM sales WHERE id = $1`,
      [data.saleId],
    );
    const sale = saleRows[0];
    if (!sale) throw ApiError.notFound("Original sale not found");
    if (sale.status === "cancelled") {
      throw ApiError.badRequest("Cannot return items from a cancelled sale");
    }

    // Validate each returned item was on the original sale
    for (const item of data.items) {
      const { rows } = await query(
        `SELECT quantity FROM sales_items WHERE sale_id = $1 AND product_id = $2`,
        [data.saleId, item.productId],
      );
      if (!rows[0]) {
        throw ApiError.badRequest(
          `Product "${item.productId}" was not on this sale`,
        );
      }
      if (item.quantity > rows[0].quantity) {
        throw ApiError.badRequest(
          `Return quantity (${item.quantity}) exceeds sold quantity (${rows[0].quantity}) for product "${item.productId}"`,
        );
      }
    }

    const totalAmount = data.items.reduce(
      (s, i) => s + i.quantity * i.unitPrice,
      0,
    );
    const customerId = data.customerId ?? sale.customer_id ?? null;

    const returnId = await withTransaction(async (client) => {
      const id = await salesReturnRepository.create(
        { ...data, totalAmount, customerId },
        storeId,
        userId,
        createdBy,
      );
      await salesReturnRepository.createItems(id, data.items, createdBy);
      return id;
    });

    return this.getById(returnId);
  },

  async approve(id, approvedBy, notes) {
    const ret = await salesReturnRepository.findByIdWithItems(id);
    if (!ret) throw ApiError.notFound("Sales return not found");
    if (ret.status !== "pending") {
      throw ApiError.badRequest(
        `Cannot approve a return with status "${ret.status}"`,
      );
    }

    // Re-stock returned items and record movements
    const items =
      typeof ret.items === "string" ? JSON.parse(ret.items) : (ret.items ?? []);

    await withTransaction(async (client) => {
      await salesReturnRepository.updateStatus(
        id,
        "approved",
        approvedBy,
        notes,
      );

      for (const item of items) {
        // Check product type
        const { rows: typeRows } = await client.query(
          `SELECT type FROM products WHERE id = $1`,
          [item.productId],
        );
        if (typeRows[0]?.type !== "inventory") continue;

        await client.query(
          `UPDATE stock SET quantity = quantity + $1, updated_at = NOW(), updated_by = $3
           WHERE product_id = $2 AND store_id = $4`,
          [item.quantity, item.productId, approvedBy, ret.store_id],
        );
        await client.query(
          `INSERT INTO stock_movements
             (product_id, store_id, movement_type, quantity_change, reference_type, reference_id, note, created_by)
           VALUES ($1,$2,'return',$3,'return',$4,$5,$6)`,
          [
            item.productId,
            ret.store_id,
            item.quantity,
            id,
            `Return ${ret.return_number}`,
            approvedBy,
          ],
        );
      }
    });

    return this.getById(id);
  },

  async reject(id, rejectedBy, notes) {
    const ret = await salesReturnRepository.findByIdWithItems(id);
    if (!ret) throw ApiError.notFound("Sales return not found");
    if (ret.status !== "pending") {
      throw ApiError.badRequest(
        `Cannot reject a return with status "${ret.status}"`,
      );
    }
    await salesReturnRepository.updateStatus(id, "rejected", rejectedBy, notes);
    return this.getById(id);
  },
};
