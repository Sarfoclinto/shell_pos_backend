import { purchaseOrderRepository } from "../repositories/purchase-order.repository.js";
import { ApiError } from "../utils/api-error.js";
import { paginate } from "../utils/pagination.js";
import { withTransaction } from "../config/database.js";
import { query } from "../config/database.js";

const serializeItems = (raw) => {
  const items = typeof raw === "string" ? JSON.parse(raw) : (raw ?? []);
  return items.map((i) => ({
    id: i.id,
    productId: i.productId,
    productName: i.productName,
    sku: i.sku,
    quantityOrdered: i.quantityOrdered,
    quantityReceived: i.quantityReceived,
    unitPrice: parseFloat(i.unitPrice),
    totalPrice: parseFloat(i.totalPrice),
    fullyReceived: i.quantityReceived >= i.quantityOrdered,
  }));
};

const serializeList = (row) => ({
  id: row.id,
  orderNumber: row.order_number,
  status: row.status,
  totalAmount: parseFloat(row.total_amount),
  orderDate: row.order_date,
  expectedDeliveryDate: row.expected_delivery_date ?? null,
  supplier: { name: row.supplier_name },
  store: { name: row.store_name, code: row.store_code },
  createdBy: { firstName: row.first_name, lastName: row.last_name },
  createdAt: row.created_at,
  items: serializeItems(row.items),
});

const serializeDetail = (row) => ({
  ...serializeList(row),
  supplierPhone: row.supplier_phone ?? null,
  // items already included via serializeList — serializeDetail adds supplier phone only
});

export const purchaseOrderService = {
  async list(queryParams) {
    const { page, limit, offset } = paginate(queryParams);
    const { rows, total } = await purchaseOrderRepository.findAll({
      storeId: queryParams.storeId || undefined,
      supplierId: queryParams.supplierId || undefined,
      status: queryParams.status || undefined,
      from: queryParams.from || undefined,
      to: queryParams.to || undefined,
      limit,
      offset,
    });
    return {
      purchaseOrders: rows.map(serializeList),
      pagination: { page, limit, total },
    };
  },

  async getById(id) {
    const po = await purchaseOrderRepository.findByIdWithItems(id);
    if (!po) throw ApiError.notFound("Purchase order not found");
    return serializeDetail(po);
  },

  async create(data, storeId, userId, createdBy) {
    // Validate all products exist
    for (const item of data.items) {
      const { rows } = await query(
        `SELECT id, name FROM products WHERE id = $1 AND deleted_at IS NULL`,
        [item.productId],
      );
      if (!rows[0])
        throw ApiError.badRequest(`Product "${item.productId}" not found`);
    }

    const totalAmount = data.items.reduce(
      (sum, i) => sum + i.quantityOrdered * i.unitPrice,
      0,
    );

    const poId = await withTransaction(async (client) => {
      const id = await purchaseOrderRepository.create(
        { ...data, totalAmount },
        storeId,
        userId,
        createdBy,
      );
      await purchaseOrderRepository.createItems(id, data.items, createdBy);
      return id;
    });

    return this.getById(poId);
  },

  async markOrdered(id, updatedBy) {
    const po = await purchaseOrderRepository.findByIdWithItems(id);
    if (!po) throw ApiError.notFound("Purchase order not found");
    if (po.status !== "pending") {
      throw ApiError.badRequest(
        `Cannot mark as ordered — current status is "${po.status}"`,
      );
    }
    await purchaseOrderRepository.updateStatus(id, "ordered", updatedBy);
    return this.getById(id);
  },

  async receiveItems(id, items, storeId, updatedBy) {
    const po = await purchaseOrderRepository.findByIdWithItems(id);
    if (!po) throw ApiError.notFound("Purchase order not found");
    if (!["ordered", "pending"].includes(po.status)) {
      throw ApiError.badRequest(
        `Cannot receive items — PO status is "${po.status}"`,
      );
    }
    await purchaseOrderRepository.receiveItems(id, items, storeId, updatedBy);
    return this.getById(id);
  },

  async cancel(id, updatedBy) {
    const po = await purchaseOrderRepository.findByIdWithItems(id);
    if (!po) throw ApiError.notFound("Purchase order not found");
    if (!["pending", "ordered"].includes(po.status)) {
      throw ApiError.badRequest(
        `Cannot cancel a purchase order with status "${po.status}"`,
      );
    }
    await purchaseOrderRepository.updateStatus(id, "cancelled", updatedBy);
    return this.getById(id);
  },
};
