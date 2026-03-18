/**
 * Migration: 002_full_schema
 * Full POS schema covering:
 *   Auth, Stores, Users, Customers
 *   Products (Base + Variants), Stock, StockMovements
 *   Shifts, Sales, Payments, PaymentSplits
 *   SalesReturns, PurchaseOrders, Suppliers
 *   InventoryAdjustments, StockTransfers
 *
 * Conventions:
 *   - All PKs:        UUID, uuid_generate_v4()
 *   - Audit columns:  created_at, created_by, updated_at, updated_by
 *   - Soft deletes:   deleted_at (where applicable)
 *   - Monetary:       NUMERIC(12,2)
 *   - Quantities:     INTEGER
 */

export const up = async (query) => {
  await query(`

-- ══════════════════════════════════════════════
-- EXTENSIONS
-- ══════════════════════════════════════════════
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";


-- ══════════════════════════════════════════════
-- SECTION 1 — AUTH & HUMAN ENTITIES
-- ══════════════════════════════════════════════

-- ─── Roles ────────────────────────────────────
CREATE TABLE IF NOT EXISTS roles (
  id              UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  name            VARCHAR(100)  NOT NULL UNIQUE,
  dashboard_type  VARCHAR(20)   NOT NULL CHECK (dashboard_type IN ('admin', 'cashier')),
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  created_by      UUID,
  updated_at      TIMESTAMPTZ,
  updated_by      UUID
);

-- ─── Controls / Permissions ───────────────────
CREATE TABLE IF NOT EXISTS controls (
  id          UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  code        VARCHAR(100)  NOT NULL UNIQUE,  -- e.g. 'sales.create', 'reports.view'
  name        VARCHAR(150)  NOT NULL,
  created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  created_by  UUID,
  updated_at  TIMESTAMPTZ,
  updated_by  UUID
);

-- ─── Role → Control (default permissions) ────
CREATE TABLE IF NOT EXISTS role_control_mapping (
  id          UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  role_id     UUID          NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  control_id  UUID          NOT NULL REFERENCES controls(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  created_by  UUID,
  UNIQUE (role_id, control_id)
);

-- ─── Stores ───────────────────────────────────
CREATE TABLE IF NOT EXISTS stores (
  id          UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  code        VARCHAR(5)    NOT NULL UNIQUE,  -- e.g. 'ACC', 'KSI' — used in receipt numbers
  name        VARCHAR(150)  NOT NULL,
  address     TEXT,
  region      VARCHAR(100),
  city        VARCHAR(100),
  contact     VARCHAR(50),
  is_active   BOOLEAN       NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  created_by  UUID,
  updated_at  TIMESTAMPTZ,
  updated_by  UUID,
  deleted_at  TIMESTAMPTZ
);

-- ─── Users ────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id            UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  first_name    VARCHAR(100)  NOT NULL,
  last_name     VARCHAR(100)  NOT NULL,
  phone         VARCHAR(30)   NOT NULL UNIQUE,
  email         VARCHAR(255)  UNIQUE,
  address       TEXT,
  region        VARCHAR(100),
  city          VARCHAR(100),
  password_hash TEXT          NOT NULL,
  store_id      UUID          REFERENCES stores(id) ON DELETE SET NULL,
  role_id       UUID          NOT NULL REFERENCES roles(id),
  is_active     BOOLEAN       NOT NULL DEFAULT TRUE,
  last_login_at TIMESTAMPTZ,
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  created_by    UUID,
  updated_at    TIMESTAMPTZ,
  updated_by    UUID,
  deleted_at    TIMESTAMPTZ
);

-- Self-referencing FK now that users table exists
ALTER TABLE roles               ADD FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE roles               ADD FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE controls            ADD FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE controls            ADD FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE role_control_mapping ADD FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE stores              ADD FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE stores              ADD FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL;

-- ─── User → Control (per-user overrides) ──────
CREATE TABLE IF NOT EXISTS user_control_mapping (
  id          UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  control_id  UUID    NOT NULL REFERENCES controls(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by  UUID        REFERENCES users(id) ON DELETE SET NULL,
  UNIQUE (user_id, control_id)
);

-- ─── Customers ────────────────────────────────
CREATE TABLE IF NOT EXISTS customers (
  id              UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  name            VARCHAR(150)  NOT NULL,
  phone           VARCHAR(30)   NOT NULL UNIQUE,
  email           VARCHAR(255)  UNIQUE,
  address         TEXT,
  region          VARCHAR(100),
  city            VARCHAR(100),
  loyalty_points  INT           NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  created_by      UUID          REFERENCES users(id) ON DELETE SET NULL,
  updated_at      TIMESTAMPTZ,
  updated_by      UUID          REFERENCES users(id) ON DELETE SET NULL,
  deleted_at      TIMESTAMPTZ
);


-- ══════════════════════════════════════════════
-- SECTION 2 — PRODUCT ENTITIES
-- ══════════════════════════════════════════════

-- ─── Categories ───────────────────────────────
CREATE TABLE IF NOT EXISTS categories (
  id          UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        VARCHAR(100)  NOT NULL UNIQUE,
  created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  created_by  UUID          REFERENCES users(id) ON DELETE SET NULL,
  updated_at  TIMESTAMPTZ,
  updated_by  UUID          REFERENCES users(id) ON DELETE SET NULL,
  deleted_at  TIMESTAMPTZ
);

-- ─── Base Products ────────────────────────────
-- Represents the "concept" (e.g. Coca-Cola).
-- Used for grouping, display, and reporting only.
CREATE TABLE IF NOT EXISTS base_products (
  id           UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  name         VARCHAR(255)  NOT NULL,
  description  TEXT,
  category_id  UUID          REFERENCES categories(id) ON DELETE SET NULL,
  image_url    TEXT,
  created_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  created_by   UUID          REFERENCES users(id) ON DELETE SET NULL,
  updated_at   TIMESTAMPTZ,
  updated_by   UUID          REFERENCES users(id) ON DELETE SET NULL,
  deleted_at   TIMESTAMPTZ
);

-- ─── Product Variants (dimension labels) ──────
-- Stores the variant label only, e.g. "500ml", "1L", "Red / Large"
CREATE TABLE IF NOT EXISTS product_variants (
  id          UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  variation   VARCHAR(100)  NOT NULL UNIQUE,
  created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  created_by  UUID          REFERENCES users(id) ON DELETE SET NULL,
  updated_at  TIMESTAMPTZ,
  updated_by  UUID          REFERENCES users(id) ON DELETE SET NULL
);

-- ─── Products (sellable SKUs) ─────────────────
-- Each row is one fully-priced, fully-stocked sellable unit.
CREATE TABLE IF NOT EXISTS products (
  id               UUID            PRIMARY KEY DEFAULT uuid_generate_v4(),
  base_product_id  UUID            NOT NULL REFERENCES base_products(id) ON DELETE RESTRICT,
  variant_id       UUID            REFERENCES product_variants(id) ON DELETE SET NULL,
  category_id      UUID            REFERENCES categories(id) ON DELETE SET NULL,
  name             VARCHAR(255)    NOT NULL,    -- denormalised for fast display (e.g. "Coca-Cola 500ml")
  sku              VARCHAR(100)    NOT NULL UNIQUE,
  barcode          VARCHAR(100)    UNIQUE,
  price            NUMERIC(12,2)   NOT NULL CHECK (price >= 0),
  cost_price       NUMERIC(12,2)            CHECK (cost_price >= 0),
  type             VARCHAR(20)     NOT NULL DEFAULT 'inventory'
                     CHECK (type IN ('inventory', 'non-inventory')),
  is_active        BOOLEAN         NOT NULL DEFAULT TRUE,
  created_at       TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  created_by       UUID            REFERENCES users(id) ON DELETE SET NULL,
  updated_at       TIMESTAMPTZ,
  updated_by       UUID            REFERENCES users(id) ON DELETE SET NULL,
  deleted_at       TIMESTAMPTZ
);


-- ══════════════════════════════════════════════
-- SECTION 3 — STOCK & INVENTORY
-- ══════════════════════════════════════════════

-- ─── Stock (current quantity per product per store) ──
CREATE TABLE IF NOT EXISTS stock (
  id          UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id  UUID    NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  store_id    UUID    NOT NULL REFERENCES stores(id)   ON DELETE CASCADE,
  quantity    INT     NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by  UUID        REFERENCES users(id) ON DELETE SET NULL,
  updated_at  TIMESTAMPTZ,
  updated_by  UUID        REFERENCES users(id) ON DELETE SET NULL,
  UNIQUE (product_id, store_id)
);

-- ─── Stock Movements (full audit trail) ───────
CREATE TABLE IF NOT EXISTS stock_movements (
  id               UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id       UUID          NOT NULL REFERENCES products(id),
  store_id         UUID          NOT NULL REFERENCES stores(id),
  movement_type    VARCHAR(20)   NOT NULL
                     CHECK (movement_type IN ('sale', 'purchase', 'adjustment', 'transfer_in', 'transfer_out', 'return')),
  quantity_change  INT           NOT NULL,  -- positive = stock in, negative = stock out
  reference_type   VARCHAR(20)   NOT NULL
                     CHECK (reference_type IN ('sale', 'purchase_order', 'adjustment', 'transfer', 'return')),
  reference_id     UUID          NOT NULL,  -- FK to the source document (sale id, PO id, etc.)
  note             TEXT,
  created_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  created_by       UUID          REFERENCES users(id) ON DELETE SET NULL
);


-- ══════════════════════════════════════════════
-- SECTION 4 — SHIFTS & SALES
-- ══════════════════════════════════════════════

-- ─── Shifts ───────────────────────────────────
CREATE TABLE IF NOT EXISTS shifts (
  id              UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  store_id        UUID          NOT NULL REFERENCES stores(id),
  user_id         UUID          NOT NULL REFERENCES users(id),
  opened_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  closed_at       TIMESTAMPTZ,
  opening_float   NUMERIC(12,2) NOT NULL DEFAULT 0.00,  -- cash placed in drawer at open
  closing_cash    NUMERIC(12,2),                        -- cash counted at close
  expected_cash   NUMERIC(12,2),                        -- calculated: float + cash sales
  difference      NUMERIC(12,2),                        -- closing_cash - expected_cash
  status          VARCHAR(10)   NOT NULL DEFAULT 'open'
                    CHECK (status IN ('open', 'closed')),
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  created_by      UUID          REFERENCES users(id) ON DELETE SET NULL,
  updated_at      TIMESTAMPTZ,
  updated_by      UUID          REFERENCES users(id) ON DELETE SET NULL
);

-- ─── Sales ────────────────────────────────────
CREATE TABLE IF NOT EXISTS sales (
  id               UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  receipt_number   VARCHAR(50)   NOT NULL UNIQUE,
  -- Format: {StoreCode}-{YYYYMMDDhhmmss}-{XXXX}
  shift_id         UUID          NOT NULL REFERENCES shifts(id),
  store_id         UUID          NOT NULL REFERENCES stores(id),
  user_id          UUID          NOT NULL REFERENCES users(id),
  customer_id      UUID          REFERENCES customers(id) ON DELETE SET NULL,
  total_amount     NUMERIC(12,2) NOT NULL DEFAULT 0,
  discount_amount  NUMERIC(12,2) NOT NULL DEFAULT 0,
  tax_amount       NUMERIC(12,2) NOT NULL DEFAULT 0,
  final_amount     NUMERIC(12,2) NOT NULL DEFAULT 0,
  status           VARCHAR(20)   NOT NULL DEFAULT 'completed'
                     CHECK (status IN ('completed', 'pending', 'cancelled')),
  created_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  created_by       UUID          REFERENCES users(id) ON DELETE SET NULL,
  updated_at       TIMESTAMPTZ,
  updated_by       UUID          REFERENCES users(id) ON DELETE SET NULL,
  deleted_at       TIMESTAMPTZ
);

-- ─── Sales Items ──────────────────────────────
CREATE TABLE IF NOT EXISTS sales_items (
  id           UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  sale_id      UUID          NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  product_id   UUID          NOT NULL REFERENCES products(id),
  quantity     INT           NOT NULL CHECK (quantity > 0),
  unit_price   NUMERIC(12,2) NOT NULL,
  total_price  NUMERIC(12,2) NOT NULL,
  created_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  created_by   UUID          REFERENCES users(id) ON DELETE SET NULL
);

-- ─── Payments ─────────────────────────────────
CREATE TABLE IF NOT EXISTS payments (
  id               UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  sale_id          UUID          NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  payment_method   VARCHAR(20)   NOT NULL
                     CHECK (payment_method IN ('cash', 'card', 'mobile_money', 'split', 'other')),
  amount           NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  payment_status   VARCHAR(10)   NOT NULL DEFAULT 'paid'
                     CHECK (payment_status IN ('paid', 'pending', 'failed')),
  reference_number VARCHAR(100)  UNIQUE,  -- for card / mobile money; NULL for cash
  paid_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  created_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  created_by       UUID          REFERENCES users(id) ON DELETE SET NULL
);

-- ─── Payment Splits ───────────────────────────
-- Only populated when payment_method = 'split'
CREATE TABLE IF NOT EXISTS payment_splits (
  id          UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  payment_id  UUID          NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
  method      VARCHAR(20)   NOT NULL
                CHECK (method IN ('cash', 'card', 'mobile_money', 'other')),
  amount      NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  reference_number VARCHAR(100),
  created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  created_by  UUID          REFERENCES users(id) ON DELETE SET NULL
);


-- ══════════════════════════════════════════════
-- SECTION 5 — SALES RETURNS
-- ══════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS sales_returns (
  id             UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  return_number  VARCHAR(50)   NOT NULL UNIQUE,
  -- Format: SR-{YYYYMMDDhhmmss}-{XXXX}
  sale_id        UUID          NOT NULL REFERENCES sales(id),
  store_id       UUID          NOT NULL REFERENCES stores(id),
  user_id        UUID          NOT NULL REFERENCES users(id),
  customer_id    UUID          REFERENCES customers(id) ON DELETE SET NULL,
  reason         TEXT,
  total_amount   NUMERIC(12,2) NOT NULL DEFAULT 0,
  status         VARCHAR(10)   NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  created_by     UUID          REFERENCES users(id) ON DELETE SET NULL,
  updated_at     TIMESTAMPTZ,
  updated_by     UUID          REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS sales_return_items (
  id              UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  sales_return_id UUID          NOT NULL REFERENCES sales_returns(id) ON DELETE CASCADE,
  product_id      UUID          NOT NULL REFERENCES products(id),
  quantity        INT           NOT NULL CHECK (quantity > 0),
  unit_price      NUMERIC(12,2) NOT NULL,
  total_price     NUMERIC(12,2) NOT NULL,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  created_by      UUID          REFERENCES users(id) ON DELETE SET NULL
);


-- ══════════════════════════════════════════════
-- SECTION 6 — SUPPLIERS & PURCHASE ORDERS
-- ══════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS suppliers (
  id              UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  name            VARCHAR(150)  NOT NULL,
  contact_person  VARCHAR(150),
  phone           VARCHAR(30)   NOT NULL UNIQUE,
  email           VARCHAR(255)  UNIQUE,
  address         TEXT,
  region          VARCHAR(100),
  city            VARCHAR(100),
  is_active       BOOLEAN       NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  created_by      UUID          REFERENCES users(id) ON DELETE SET NULL,
  updated_at      TIMESTAMPTZ,
  updated_by      UUID          REFERENCES users(id) ON DELETE SET NULL,
  deleted_at      TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS purchase_orders (
  id                     UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_number           VARCHAR(50)   NOT NULL UNIQUE,
  -- Format: PO-{YYYYMMDDhhmmss}-{XXXX}
  supplier_id            UUID          NOT NULL REFERENCES suppliers(id),
  store_id               UUID          NOT NULL REFERENCES stores(id),
  user_id                UUID          NOT NULL REFERENCES users(id),
  status                 VARCHAR(20)   NOT NULL DEFAULT 'pending'
                           CHECK (status IN ('pending', 'ordered', 'received', 'cancelled')),
  total_amount           NUMERIC(12,2) NOT NULL DEFAULT 0,
  expected_delivery_date DATE,
  order_date             TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  created_at             TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  created_by             UUID          REFERENCES users(id) ON DELETE SET NULL,
  updated_at             TIMESTAMPTZ,
  updated_by             UUID          REFERENCES users(id) ON DELETE SET NULL,
  deleted_at             TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS purchase_order_items (
  id                 UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  purchase_order_id  UUID          NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  product_id         UUID          NOT NULL REFERENCES products(id),
  quantity_ordered   INT           NOT NULL CHECK (quantity_ordered > 0),
  quantity_received  INT           NOT NULL DEFAULT 0,
  unit_price         NUMERIC(12,2) NOT NULL,
  total_price        NUMERIC(12,2) NOT NULL,
  created_at         TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  created_by         UUID          REFERENCES users(id) ON DELETE SET NULL,
  updated_at         TIMESTAMPTZ,
  updated_by         UUID          REFERENCES users(id) ON DELETE SET NULL
);


-- ══════════════════════════════════════════════
-- SECTION 7 — INVENTORY ADJUSTMENTS
-- ══════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS inventory_adjustments (
  id                UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  adjustment_number VARCHAR(50)   NOT NULL UNIQUE,
  -- Format: IA-{YYYYMMDDhhmmss}-{XXXX}
  store_id          UUID          NOT NULL REFERENCES stores(id),
  user_id           UUID          NOT NULL REFERENCES users(id),
  adjustment_type   VARCHAR(10)   NOT NULL CHECK (adjustment_type IN ('positive', 'negative')),
  reason            VARCHAR(30)   NOT NULL
                      CHECK (reason IN ('stock-count', 'damaged-items', 'lost-items', 'manual-correction', 'other')),
  notes             TEXT,
  status            VARCHAR(10)   NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending', 'approved', 'rejected')),
  approved_by       UUID          REFERENCES users(id) ON DELETE SET NULL,
  approved_at       TIMESTAMPTZ,
  created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  created_by        UUID          REFERENCES users(id) ON DELETE SET NULL,
  updated_at        TIMESTAMPTZ,
  updated_by        UUID          REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS inventory_adjustment_items (
  id                      UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
  inventory_adjustment_id UUID    NOT NULL REFERENCES inventory_adjustments(id) ON DELETE CASCADE,
  product_id              UUID    NOT NULL REFERENCES products(id),
  system_quantity         INT     NOT NULL,  -- quantity before adjustment
  adjusted_quantity       INT     NOT NULL,  -- quantity after adjustment
  difference              INT     NOT NULL,  -- adjusted_quantity - system_quantity
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by              UUID        REFERENCES users(id) ON DELETE SET NULL
);


-- ══════════════════════════════════════════════
-- SECTION 8 — STOCK TRANSFERS
-- ══════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS stock_transfers (
  id               UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  transfer_number  VARCHAR(50)   NOT NULL UNIQUE,
  -- Format: ST-{YYYYMMDDhhmmss}-{XXXX}
  from_store_id    UUID          NOT NULL REFERENCES stores(id),
  to_store_id      UUID          NOT NULL REFERENCES stores(id),
  user_id          UUID          NOT NULL REFERENCES users(id),  -- initiator
  approved_by      UUID          REFERENCES users(id) ON DELETE SET NULL,  -- approver (must differ from initiator)
  approved_at      TIMESTAMPTZ,
  status           VARCHAR(20)   NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending', 'in_transit', 'completed', 'cancelled')),
  total_quantity   INT           NOT NULL DEFAULT 0,
  notes            TEXT,
  created_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  created_by       UUID          REFERENCES users(id) ON DELETE SET NULL,
  updated_at       TIMESTAMPTZ,
  updated_by       UUID          REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT different_stores CHECK (from_store_id != to_store_id)
);

CREATE TABLE IF NOT EXISTS stock_transfer_items (
  id                  UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
  stock_transfer_id   UUID    NOT NULL REFERENCES stock_transfers(id) ON DELETE CASCADE,
  product_id          UUID    NOT NULL REFERENCES products(id),
  quantity            INT     NOT NULL CHECK (quantity > 0),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by          UUID        REFERENCES users(id) ON DELETE SET NULL
);


-- ══════════════════════════════════════════════
-- SECTION 9 — INDEXES
-- ══════════════════════════════════════════════

-- Users
CREATE INDEX IF NOT EXISTS idx_users_store      ON users(store_id);
CREATE INDEX IF NOT EXISTS idx_users_role       ON users(role_id);
CREATE INDEX IF NOT EXISTS idx_users_phone      ON users(phone);

-- Products
CREATE INDEX IF NOT EXISTS idx_products_base    ON products(base_product_id);
CREATE INDEX IF NOT EXISTS idx_products_variant ON products(variant_id);
CREATE INDEX IF NOT EXISTS idx_products_sku     ON products(sku);
CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);
CREATE INDEX IF NOT EXISTS idx_products_active  ON products(is_active) WHERE deleted_at IS NULL;

-- Base Products
CREATE INDEX IF NOT EXISTS idx_base_products_category ON base_products(category_id);

-- Stock
CREATE INDEX IF NOT EXISTS idx_stock_product    ON stock(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_store      ON stock(store_id);

-- Stock Movements
CREATE INDEX IF NOT EXISTS idx_movements_product   ON stock_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_movements_store     ON stock_movements(store_id);
CREATE INDEX IF NOT EXISTS idx_movements_reference ON stock_movements(reference_id);
CREATE INDEX IF NOT EXISTS idx_movements_type      ON stock_movements(movement_type);
CREATE INDEX IF NOT EXISTS idx_movements_created   ON stock_movements(created_at);

-- Shifts
CREATE INDEX IF NOT EXISTS idx_shifts_store     ON shifts(store_id);
CREATE INDEX IF NOT EXISTS idx_shifts_user      ON shifts(user_id);
CREATE INDEX IF NOT EXISTS idx_shifts_status    ON shifts(status);

-- Sales
CREATE INDEX IF NOT EXISTS idx_sales_shift      ON sales(shift_id);
CREATE INDEX IF NOT EXISTS idx_sales_store      ON sales(store_id);
CREATE INDEX IF NOT EXISTS idx_sales_user       ON sales(user_id);
CREATE INDEX IF NOT EXISTS idx_sales_customer   ON sales(customer_id);
CREATE INDEX IF NOT EXISTS idx_sales_status     ON sales(status);
CREATE INDEX IF NOT EXISTS idx_sales_created    ON sales(created_at);

-- Sales Items
CREATE INDEX IF NOT EXISTS idx_sales_items_sale    ON sales_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_sales_items_product ON sales_items(product_id);

-- Payments
CREATE INDEX IF NOT EXISTS idx_payments_sale    ON payments(sale_id);
CREATE INDEX IF NOT EXISTS idx_payment_splits_payment ON payment_splits(payment_id);

-- Purchase Orders
CREATE INDEX IF NOT EXISTS idx_po_supplier      ON purchase_orders(supplier_id);
CREATE INDEX IF NOT EXISTS idx_po_store         ON purchase_orders(store_id);
CREATE INDEX IF NOT EXISTS idx_po_status        ON purchase_orders(status);
CREATE INDEX IF NOT EXISTS idx_poi_order        ON purchase_order_items(purchase_order_id);
CREATE INDEX IF NOT EXISTS idx_poi_product      ON purchase_order_items(product_id);

-- Sales Returns
CREATE INDEX IF NOT EXISTS idx_sr_sale          ON sales_returns(sale_id);
CREATE INDEX IF NOT EXISTS idx_sr_store         ON sales_returns(store_id);
CREATE INDEX IF NOT EXISTS idx_sri_return       ON sales_return_items(sales_return_id);

-- Inventory Adjustments
CREATE INDEX IF NOT EXISTS idx_ia_store         ON inventory_adjustments(store_id);
CREATE INDEX IF NOT EXISTS idx_ia_status        ON inventory_adjustments(status);
CREATE INDEX IF NOT EXISTS idx_iai_adjustment   ON inventory_adjustment_items(inventory_adjustment_id);
CREATE INDEX IF NOT EXISTS idx_iai_product      ON inventory_adjustment_items(product_id);

-- Stock Transfers
CREATE INDEX IF NOT EXISTS idx_st_from_store    ON stock_transfers(from_store_id);
CREATE INDEX IF NOT EXISTS idx_st_to_store      ON stock_transfers(to_store_id);
CREATE INDEX IF NOT EXISTS idx_st_status        ON stock_transfers(status);
CREATE INDEX IF NOT EXISTS idx_sti_transfer     ON stock_transfer_items(stock_transfer_id);
CREATE INDEX IF NOT EXISTS idx_sti_product      ON stock_transfer_items(product_id);

  `);
};

export const down = async (query) => {
  await query(`
    DROP TABLE IF EXISTS stock_transfer_items       CASCADE;
    DROP TABLE IF EXISTS stock_transfers            CASCADE;
    DROP TABLE IF EXISTS inventory_adjustment_items CASCADE;
    DROP TABLE IF EXISTS inventory_adjustments      CASCADE;
    DROP TABLE IF EXISTS purchase_order_items       CASCADE;
    DROP TABLE IF EXISTS purchase_orders            CASCADE;
    DROP TABLE IF EXISTS suppliers                  CASCADE;
    DROP TABLE IF EXISTS sales_return_items         CASCADE;
    DROP TABLE IF EXISTS sales_returns              CASCADE;
    DROP TABLE IF EXISTS payment_splits             CASCADE;
    DROP TABLE IF EXISTS payments                   CASCADE;
    DROP TABLE IF EXISTS sales_items                CASCADE;
    DROP TABLE IF EXISTS sales                      CASCADE;
    DROP TABLE IF EXISTS shifts                     CASCADE;
    DROP TABLE IF EXISTS stock_movements            CASCADE;
    DROP TABLE IF EXISTS stock                      CASCADE;
    DROP TABLE IF EXISTS products                   CASCADE;
    DROP TABLE IF EXISTS product_variants           CASCADE;
    DROP TABLE IF EXISTS base_products              CASCADE;
    DROP TABLE IF EXISTS categories                 CASCADE;
    DROP TABLE IF EXISTS customers                  CASCADE;
    DROP TABLE IF EXISTS user_control_mapping       CASCADE;
    DROP TABLE IF EXISTS users                      CASCADE;
    DROP TABLE IF EXISTS stores                     CASCADE;
    DROP TABLE IF EXISTS role_control_mapping       CASCADE;
    DROP TABLE IF EXISTS controls                   CASCADE;
    DROP TABLE IF EXISTS roles                      CASCADE;
  `);
};
