/**
 * Migration: 001_initial_schema
 * Creates the core tables for the POS system:
 *   - users, roles
 *   - customers
 *   - categories, products
 *   - inventory
 *   - orders, order_items
 *   - payments
 *
 * All tables use:
 *   - UUID primary keys
 *   - created_at / updated_at timestamps
 *   - deleted_at for soft deletes
 */

export const up = async (query) => {
  await query(`
    -- Enable UUID extension
    CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

    -- ─────────────────────────────────────
    -- USERS
    -- ─────────────────────────────────────
    CREATE TABLE IF NOT EXISTS users (
      id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      name          VARCHAR(150)  NOT NULL,
      email         VARCHAR(255)  NOT NULL UNIQUE,
      password_hash TEXT          NOT NULL,
      role          VARCHAR(50)   NOT NULL DEFAULT 'cashier'
                      CHECK (role IN ('admin', 'manager', 'cashier')),
      is_active     BOOLEAN       NOT NULL DEFAULT TRUE,
      last_login_at TIMESTAMPTZ,
      created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
      updated_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
      deleted_at    TIMESTAMPTZ
    );

    -- ─────────────────────────────────────
    -- CUSTOMERS
    -- ─────────────────────────────────────
    CREATE TABLE IF NOT EXISTS customers (
      id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      name          VARCHAR(150)  NOT NULL,
      email         VARCHAR(255)  UNIQUE,
      phone         VARCHAR(30),
      address       TEXT,
      loyalty_points INT          NOT NULL DEFAULT 0,
      created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
      updated_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
      deleted_at    TIMESTAMPTZ
    );

    -- ─────────────────────────────────────
    -- CATEGORIES
    -- ─────────────────────────────────────
    CREATE TABLE IF NOT EXISTS categories (
      id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      name          VARCHAR(100)  NOT NULL UNIQUE,
      description   TEXT,
      created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
      updated_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
      deleted_at    TIMESTAMPTZ
    );

    -- ─────────────────────────────────────
    -- PRODUCTS
    -- ─────────────────────────────────────
    CREATE TABLE IF NOT EXISTS products (
      id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      category_id   UUID          REFERENCES categories(id) ON DELETE SET NULL,
      name          VARCHAR(255)  NOT NULL,
      sku           VARCHAR(100)  NOT NULL UNIQUE,
      barcode       VARCHAR(100)  UNIQUE,
      description   TEXT,
      price         NUMERIC(12,2) NOT NULL CHECK (price >= 0),
      cost_price    NUMERIC(12,2)          CHECK (cost_price >= 0),
      tax_rate      NUMERIC(5,2)  NOT NULL DEFAULT 0.00,
      unit          VARCHAR(50)   NOT NULL DEFAULT 'piece',
      image_url     TEXT,
      is_active     BOOLEAN       NOT NULL DEFAULT TRUE,
      created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
      updated_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
      deleted_at    TIMESTAMPTZ
    );

    -- ─────────────────────────────────────
    -- INVENTORY
    -- ─────────────────────────────────────
    CREATE TABLE IF NOT EXISTS inventory (
      id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      product_id        UUID          NOT NULL UNIQUE REFERENCES products(id) ON DELETE CASCADE,
      quantity_on_hand  INT           NOT NULL DEFAULT 0 CHECK (quantity_on_hand >= 0),
      reorder_level     INT           NOT NULL DEFAULT 10,
      reorder_quantity  INT           NOT NULL DEFAULT 50,
      last_restocked_at TIMESTAMPTZ,
      created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
      updated_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW()
    );

    -- ─────────────────────────────────────
    -- ORDERS
    -- ─────────────────────────────────────
    CREATE TABLE IF NOT EXISTS orders (
      id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      order_number    VARCHAR(50)   NOT NULL UNIQUE,
      customer_id     UUID          REFERENCES customers(id) ON DELETE SET NULL,
      cashier_id      UUID          NOT NULL REFERENCES users(id),
      status          VARCHAR(50)   NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending', 'completed', 'refunded', 'cancelled')),
      subtotal        NUMERIC(12,2) NOT NULL DEFAULT 0,
      tax_amount      NUMERIC(12,2) NOT NULL DEFAULT 0,
      discount_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
      total_amount    NUMERIC(12,2) NOT NULL DEFAULT 0,
      notes           TEXT,
      created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
      updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
      deleted_at      TIMESTAMPTZ
    );

    -- ─────────────────────────────────────
    -- ORDER ITEMS
    -- ─────────────────────────────────────
    CREATE TABLE IF NOT EXISTS order_items (
      id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      order_id     UUID          NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      product_id   UUID          NOT NULL REFERENCES products(id),
      quantity     INT           NOT NULL CHECK (quantity > 0),
      unit_price   NUMERIC(12,2) NOT NULL,
      discount     NUMERIC(12,2) NOT NULL DEFAULT 0,
      tax_amount   NUMERIC(12,2) NOT NULL DEFAULT 0,
      subtotal     NUMERIC(12,2) NOT NULL,
      created_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW()
    );

    -- ─────────────────────────────────────
    -- PAYMENTS
    -- ─────────────────────────────────────
    CREATE TABLE IF NOT EXISTS payments (
      id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      order_id       UUID          NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      method         VARCHAR(50)   NOT NULL
                       CHECK (method IN ('cash', 'card', 'mobile_money', 'bank_transfer', 'other')),
      amount         NUMERIC(12,2) NOT NULL CHECK (amount > 0),
      reference      VARCHAR(255),
      status         VARCHAR(50)   NOT NULL DEFAULT 'completed'
                       CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
      paid_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
      created_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW()
    );

    -- ─────────────────────────────────────
    -- INDEXES
    -- ─────────────────────────────────────
    CREATE INDEX IF NOT EXISTS idx_products_category    ON products(category_id);
    CREATE INDEX IF NOT EXISTS idx_products_sku         ON products(sku);
    CREATE INDEX IF NOT EXISTS idx_orders_customer      ON orders(customer_id);
    CREATE INDEX IF NOT EXISTS idx_orders_cashier       ON orders(cashier_id);
    CREATE INDEX IF NOT EXISTS idx_orders_status        ON orders(status);
    CREATE INDEX IF NOT EXISTS idx_orders_created_at    ON orders(created_at);
    CREATE INDEX IF NOT EXISTS idx_order_items_order    ON order_items(order_id);
    CREATE INDEX IF NOT EXISTS idx_order_items_product  ON order_items(product_id);
    CREATE INDEX IF NOT EXISTS idx_payments_order       ON payments(order_id);
    CREATE INDEX IF NOT EXISTS idx_inventory_product    ON inventory(product_id);
  `);
};

export const down = async (query) => {
  await query(`
    DROP TABLE IF EXISTS payments       CASCADE;
    DROP TABLE IF EXISTS order_items    CASCADE;
    DROP TABLE IF EXISTS orders         CASCADE;
    DROP TABLE IF EXISTS inventory      CASCADE;
    DROP TABLE IF EXISTS products       CASCADE;
    DROP TABLE IF EXISTS categories     CASCADE;
    DROP TABLE IF EXISTS customers      CASCADE;
    DROP TABLE IF EXISTS users          CASCADE;
  `);
};
