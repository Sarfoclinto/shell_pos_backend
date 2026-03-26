// import { customerRepository } from "../repositories/customer.repository.js";
import { saleRepository } from "../repositories/sale.repository.js";
import { ApiError } from "../utils/api-error.js";
import { paginate } from "../utils/pagination.js";
import { withTransaction } from "../config/database.js";
import { query } from "../config/database.js";

// ── Serialisers ───────────────────────────────────────────────────────────────

const serializeList = (row) => ({
  id: row.id,
  receiptNumber: row.receipt_number,
  status: row.status,
  totalAmount: parseFloat(row.total_amount),
  discountAmount: parseFloat(row.discount_amount),
  taxAmount: parseFloat(row.tax_amount),
  finalAmount: parseFloat(row.final_amount),
  paymentMethod: row.payment_method ?? null,
  paymentStatus: row.payment_status ?? null,
  cashier: {
    firstName: row.cashier_first_name,
    lastName: row.cashier_last_name,
    fullName: `${row.cashier_first_name} ${row.cashier_last_name}`,
  },
  store: {
    name: row.store_name,
    code: row.store_code,
  },
  customer: row.customer_name
    ? { name: row.customer_name, phone: row.customer_phone }
    : null,
  createdAt: row.created_at,
});

const serializeDetail = (row) => {
  const items =
    typeof row.items === "string" ? JSON.parse(row.items) : (row.items ?? []);

  const payments =
    typeof row.payments === "string"
      ? JSON.parse(row.payments)
      : (row.payments ?? []);

  return {
    id: row.id,
    receiptNumber: row.receipt_number,
    status: row.status,
    totalAmount: parseFloat(row.total_amount),
    discountAmount: parseFloat(row.discount_amount),
    taxAmount: parseFloat(row.tax_amount),
    finalAmount: parseFloat(row.final_amount),
    notes: row.notes ?? null,
    cashier: {
      firstName: row.cashier_first_name,
      lastName: row.cashier_last_name,
      fullName: `${row.cashier_first_name} ${row.cashier_last_name}`,
    },
    store: {
      name: row.store_name,
      code: row.store_code,
    },
    shift: {
      id: row.shift_id,
      openedAt: row.shift_opened_at,
    },
    customer: row.customer_name
      ? {
          id: row.customer_id,
          name: row.customer_name,
          phone: row.customer_phone,
        }
      : null,
    items: items.map((item) => ({
      id: item.id,
      productId: item.productId,
      productName: item.productName,
      sku: item.sku,
      quantity: item.quantity,
      unitPrice: parseFloat(item.unitPrice),
      totalPrice: parseFloat(item.totalPrice),
    })),
    payments: payments.map((p) => ({
      id: p.id,
      method: p.method,
      amount: parseFloat(p.amount),
      status: p.status,
      referenceNumber: p.referenceNumber ?? null,
      paidAt: p.paidAt,
      splits:
        p.splits?.map((s) => ({
          method: s.method,
          amount: parseFloat(s.amount),
          referenceNumber: s.referenceNumber ?? null,
        })) ?? undefined,
    })),
    createdAt: row.created_at,
    updatedAt: row.updated_at ?? null,
  };
};

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Validate and enrich each sale item.
 * Checks product exists, is active, is inventory type,
 * and has sufficient stock at the cashier's store.
 * Returns enriched items with totalPrice calculated.
 */
const validateAndEnrichItems = async (items, storeId) => {
  const enriched = [];

  for (const item of items) {
    const { rows } = await query(
      `SELECT
         p.id, p.name, p.sku, p.price, p.type, p.is_active,
         COALESCE(s.quantity, 0) AS stock_quantity
       FROM products p
       LEFT JOIN stock s ON s.product_id = p.id AND s.store_id = $2
       WHERE p.id = $1 AND p.deleted_at IS NULL`,
      [item.productId, storeId],
    );

    const product = rows[0];
    if (!product) {
      throw ApiError.badRequest(`Product "${item.productId}" not found`);
    }
    if (!product.is_active) {
      throw ApiError.badRequest(
        `Product "${product.name}" is inactive and cannot be sold`,
      );
    }

    // Only check stock for inventory-type products
    if (product.type === "inventory") {
      if (product.stock_quantity < item.quantity) {
        throw ApiError.badRequest(
          `Insufficient stock for "${product.name}". ` +
            `Available: ${product.stock_quantity}, requested: ${item.quantity}`,
        );
      }
    }

    const discount = parseFloat(item.discount ?? 0);
    const totalPrice = parseFloat(item.unitPrice) * item.quantity - discount;

    enriched.push({
      ...item,
      productName: product.name,
      productType: product.type,
      totalPrice,
      discount,
    });
  }

  return enriched;
};

// ── Service ───────────────────────────────────────────────────────────────────

export const saleService = {
  async list(queryParams) {
    const { page, limit, offset } = paginate(queryParams);

    const { rows, total } = await saleRepository.findAll({
      storeId: queryParams.storeId || undefined,
      shiftId: queryParams.shiftId || undefined,
      userId: queryParams.userId || undefined,
      customerId: queryParams.customerId || undefined,
      status: queryParams.status || undefined,
      from: queryParams.from || undefined,
      to: queryParams.to || undefined,
      limit,
      offset,
    });

    return {
      sales: rows.map(serializeList),
      pagination: { page, limit, total },
    };
  },

  async getById(id) {
    const sale = await saleRepository.findByIdWithDetails(id);
    if (!sale) throw ApiError.notFound("Sale not found");
    return serializeDetail(sale);
  },

  async getByReceiptNumber(receiptNumber) {
    const sale = await saleRepository.findByReceiptNumber(receiptNumber);
    if (!sale)
      throw ApiError.notFound(`No sale found with receipt "${receiptNumber}"`);
    return serializeDetail(sale);
  },

  /**
   * Create a sale — the core POS transaction.
   *
   * Everything runs in a single DB transaction:
   *   1. Validate + enrich items (stock check)
   *   2. Compute totals
   *   3. Generate receipt number
   *   4. Insert sale row
   *   5. Insert sale_items rows
   *   6. Deduct stock + record stock_movements (inventory products only)
   *   7. Insert payment row
   *   8. Insert payment_splits (if split payment)
   *   9. Award loyalty points to customer (if any)
   */
  async create(data, cashier, shift) {
    const { storeId, id: cashierId } = cashier;

    // Validate items outside the transaction (read-only checks)
    const enrichedItems = await validateAndEnrichItems(data.items, storeId);

    // Compute totals
    const subtotal = enrichedItems.reduce((sum, i) => sum + i.totalPrice, 0);
    const discountAmount = parseFloat(data.discountAmount ?? 0);
    const taxAmount = parseFloat(data.taxAmount ?? 0);
    const finalAmount = subtotal - discountAmount + taxAmount;

    // Validate payment covers the total
    const paymentAmount = parseFloat(data.payment.amount);
    if (paymentAmount < finalAmount) {
      throw ApiError.badRequest(
        `Payment amount (${paymentAmount}) is less than the sale total (${finalAmount.toFixed(2)})`,
      );
    }

    // Validate split amounts sum to payment total
    if (data.payment.method === "split") {
      const splitsTotal = data.payment.splits.reduce(
        (sum, s) => sum + parseFloat(s.amount),
        0,
      );
      if (Math.abs(splitsTotal - paymentAmount) > 0.01) {
        throw ApiError.badRequest(
          `Split amounts (${splitsTotal.toFixed(2)}) must equal the payment total (${paymentAmount.toFixed(2)})`,
        );
      }
    }

    // Get store code for receipt number
    const { rows: storeRows } = await query(
      `SELECT code FROM stores WHERE id = $1`,
      [storeId],
    );
    const storeCode = storeRows[0]?.code ?? "STR";
    const receiptNumber = await saleRepository.generateReceiptNumber(storeCode);

    const saleId = await withTransaction(async (client) => {
      // ── Insert sale ─────────────────────────────────────────────────────────
      const { rows: saleRows } = await client.query(
        `INSERT INTO sales
           (receipt_number, shift_id, store_id, user_id, customer_id,
            total_amount, discount_amount, tax_amount, final_amount,
            status, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'completed',$10)
         RETURNING id`,
        [
          receiptNumber,
          shift.id,
          storeId,
          cashierId,
          data.customerId ?? null,
          subtotal,
          discountAmount,
          taxAmount,
          finalAmount,
          cashierId,
        ],
      );
      const saleId = saleRows[0].id;

      // ── Insert items + deduct stock ─────────────────────────────────────────
      for (const item of enrichedItems) {
        await client.query(
          `INSERT INTO sales_items
             (sale_id, product_id, quantity, unit_price, total_price, created_by)
           VALUES ($1,$2,$3,$4,$5,$6)`,
          [
            saleId,
            item.productId,
            item.quantity,
            item.unitPrice,
            item.totalPrice,
            cashierId,
          ],
        );

        if (item.productType === "inventory") {
          // Deduct stock
          await client.query(
            `UPDATE stock
             SET quantity   = quantity - $1,
                 updated_at = NOW(),
                 updated_by = $3
             WHERE product_id = $2 AND store_id = $4`,
            [item.quantity, item.productId, cashierId, storeId],
          );

          // Record movement
          await client.query(
            `INSERT INTO stock_movements
               (product_id, store_id, movement_type, quantity_change,
                reference_type, reference_id, note, created_by)
             VALUES ($1,$2,'sale',$3,'sale',$4,$5,$6)`,
            [
              item.productId,
              storeId,
              -item.quantity, // negative = stock out
              saleId,
              `Sale ${receiptNumber}`,
              cashierId,
            ],
          );
        }
      }

      // ── Insert payment ──────────────────────────────────────────────────────
      const { rows: payRows } = await client.query(
        `INSERT INTO payments
           (sale_id, payment_method, amount, payment_status,
            reference_number, paid_at, created_by)
         VALUES ($1,$2,$3,'paid',$4,NOW(),$5)
         RETURNING id`,
        [
          saleId,
          data.payment.method,
          paymentAmount,
          data.payment.referenceNumber ?? null,
          cashierId,
        ],
      );
      const paymentId = payRows[0].id;

      // ── Insert split breakdown ──────────────────────────────────────────────
      if (data.payment.method === "split" && data.payment.splits?.length) {
        for (const split of data.payment.splits) {
          await client.query(
            `INSERT INTO payment_splits
               (payment_id, method, amount, reference_number, created_by)
             VALUES ($1,$2,$3,$4,$5)`,
            [
              paymentId,
              split.method,
              split.amount,
              split.referenceNumber ?? null,
              cashierId,
            ],
          );
        }
      }

      // ── Award loyalty points ────────────────────────────────────────────────
      // 1 point per whole currency unit spent
      if (data.customerId) {
        const points = Math.floor(finalAmount);
        if (points > 0) {
          await client.query(
            `UPDATE customers
             SET loyalty_points = loyalty_points + $1, updated_at = NOW()
             WHERE id = $2`,
            [points, data.customerId],
          );
        }
      }

      return saleId;
    });

    return this.getById(saleId);
  },

  /**
   * Cancel a sale — reverses stock and marks it cancelled.
   * Can only cancel completed sales.
   */
  async cancel(id, cancelledBy, reason) {
    const sale = await saleRepository.findByIdWithDetails(id);
    if (!sale) throw ApiError.notFound("Sale not found");

    if (sale.status === "cancelled") {
      throw ApiError.badRequest("This sale is already cancelled");
    }
    if (sale.status === "pending") {
      throw ApiError.badRequest(
        "Pending sales cannot be cancelled. Complete or delete them instead.",
      );
    }

    const items =
      typeof sale.items === "string"
        ? JSON.parse(sale.items)
        : (sale.items ?? []);

    await withTransaction(async (client) => {
      // ── Mark sale cancelled ─────────────────────────────────────────────────
      await client.query(
        `UPDATE sales
         SET status = 'cancelled', updated_at = NOW(), updated_by = $2,
             notes  = CASE WHEN notes IS NULL THEN $3
                           ELSE notes || ' | Cancellation: ' || $3 END
         WHERE id = $1`,
        [id, cancelledBy, reason ?? "No reason provided"],
      );

      // ── Reverse stock for inventory items ───────────────────────────────────
      for (const item of items) {
        const { rows: typeRows } = await client.query(
          `SELECT type FROM products WHERE id = $1`,
          [item.productId],
        );
        if (typeRows[0]?.type !== "inventory") continue;

        await client.query(
          `UPDATE stock
           SET quantity   = quantity + $1,
               updated_at = NOW(),
               updated_by = $3
           WHERE product_id = $2 AND store_id = $4`,
          [item.quantity, item.productId, cancelledBy, sale.store_id],
        );

        await client.query(
          `INSERT INTO stock_movements
             (product_id, store_id, movement_type, quantity_change,
              reference_type, reference_id, note, created_by)
           VALUES ($1,$2,'sale',$3,'sale',$4,$5,$6)`,
          [
            item.productId,
            sale.store_id,
            item.quantity, // positive = stock back in
            id,
            `Cancellation of ${sale.receipt_number}`,
            cancelledBy,
          ],
        );
      }

      // ── Reverse loyalty points ──────────────────────────────────────────────
      if (sale.customer_id) {
        const points = Math.floor(parseFloat(sale.final_amount));
        if (points > 0) {
          await client.query(
            `UPDATE customers
             SET loyalty_points = GREATEST(loyalty_points - $1, 0),
                 updated_at = NOW()
             WHERE id = $2`,
            [points, sale.customer_id],
          );
        }
      }

      // ── Mark payment as refunded ────────────────────────────────────────────
      await client.query(
        `UPDATE payments SET payment_status = 'refunded'
         WHERE sale_id = $1`,
        [id],
      );
    });

    return this.getById(id);
  },
};
