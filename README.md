# POS Backend API

Enterprise-grade Express.js backend for a Point-of-Sale system.

---

## Tech Stack

| Concern        | Tool                         |
|----------------|------------------------------|
| Runtime        | Node.js (ESM modules)        |
| Framework      | Express.js                   |
| Database       | PostgreSQL (via `pg` pool)   |
| Auth           | JWT (access + refresh tokens)|
| Validation     | express-validator            |
| Logging        | Winston + Daily Rotate File  |
| Auto-reload    | Nodemon                      |
| Security       | Helmet, CORS, Rate Limiting  |

---

## Project Structure

```
pos-backend/
├── server.js                   # Entry point — starts HTTP server + DB
├── app.js                      # Express app setup (middleware, routes)
├── .env                        # Local environment variables (git-ignored)
├── .env.example                # Template for environment variables
│
└── src/
    ├── config/
    │   ├── env.js              # Validates & exports all env vars
    │   ├── database.js         # pg Pool, query(), withTransaction()
    │   ├── corsOptions.js      # CORS whitelist
    │   └── logger.js           # Re-export of winston logger
    │
    ├── middlewares/
    │   ├── auth.middleware.js      # JWT authenticate + authorize(roles)
    │   ├── error.middleware.js     # Global error handler
    │   ├── validate.middleware.js  # express-validator runner
    │   ├── rateLimiter.middleware.js
    │   ├── logger.middleware.js    # Morgan HTTP logger
    │   └── notFound.middleware.js  # 404 catcher
    │
    ├── routes/
    │   ├── index.js            # Mounts all domain routers
    │   ├── auth.routes.js
    │   ├── user.routes.js
    │   ├── product.routes.js
    │   ├── customer.routes.js
    │   ├── order.routes.js
    │   ├── inventory.routes.js
    │   └── report.routes.js
    │
    ├── controllers/            # Handle req/res only — delegate to services
    │   └── *.controller.js
    │
    ├── services/               # Business logic — no req/res knowledge
    │   └── *.service.js
    │
    ├── repositories/           # All SQL lives here — no business logic
    │   ├── base.repository.js  # Generic CRUD (findById, create, update...)
    │   └── *.repository.js
    │
    ├── models/                 # Column definitions & field whitelists
    │   └── *.model.js
    │
    ├── validators/             # Input validation rules (express-validator)
    │   └── *.validator.js
    │
    ├── utils/
    │   ├── ApiError.js         # Structured error class with static helpers
    │   ├── ApiResponse.js      # Consistent JSON response helpers
    │   ├── asyncHandler.js     # Wraps async controllers to catch errors
    │   ├── pagination.js       # paginate() + paginatedResponse()
    │   └── logger.js           # Winston instance
    │
    └── db/
        ├── index.js            # Re-exports DB helpers
        ├── migrate.js          # CLI migration runner
        ├── seed.js             # CLI seed runner
        ├── migrations/
        │   └── 001_initial_schema.js
        └── seeds/
            └── 001_seed_users.js
```

---

## Architecture: 4-Layer Pattern

```
Request
  │
  ▼
Route  →  Middleware (auth, validate, rateLimit)
  │
  ▼
Controller  (req/res only — no SQL, no business rules)
  │
  ▼
Service  (business logic — transactions, validation rules, calculations)
  │
  ▼
Repository  (all SQL — no business logic)
  │
  ▼
PostgreSQL
```

---

## Getting Started

### 1. Prerequisites
- Node.js 20+
- PostgreSQL 14+ (via pgAdmin or local install)

### 2. Install dependencies
```bash
npm install
```

### 3. Configure environment
```bash
cp .env.example .env
# Edit .env and set DB_PASSWORD plus your JWT secrets
```

### 4. Create the database
Open pgAdmin → right-click Databases → Create → name it `pos_db`.

### 5. Run migrations
```bash
npm run migrate
```

### 6. Seed initial data
```bash
npm run seed
# Creates: admin@pos.com / admin123, cashier@pos.com / cashier123
```

### 7. Start dev server
```bash
npm run dev
# → http://localhost:5000/api/v1
# → http://localhost:5000/health
```

---

## API Endpoints

### Auth
| Method | Path                  | Access  |
|--------|-----------------------|---------|
| POST   | /auth/login           | Public  |
| POST   | /auth/refresh         | Public  |
| POST   | /auth/logout          | Auth    |
| GET    | /auth/me              | Auth    |

### Products
| Method | Path              | Access          |
|--------|-------------------|-----------------|
| GET    | /products         | Auth            |
| GET    | /products/:id     | Auth            |
| POST   | /products         | Admin, Manager  |
| PUT    | /products/:id     | Admin, Manager  |
| DELETE | /products/:id     | Admin           |

### Orders
| Method | Path                    | Access          |
|--------|-------------------------|-----------------|
| GET    | /orders                 | Auth            |
| GET    | /orders/:id             | Auth            |
| POST   | /orders                 | Auth            |
| PATCH  | /orders/:id/cancel      | Admin, Manager  |

### Inventory
| Method | Path                              | Access          |
|--------|-----------------------------------|-----------------|
| GET    | /inventory/low-stock              | Auth            |
| GET    | /inventory/:productId             | Auth            |
| PATCH  | /inventory/:productId/adjust      | Admin, Manager  |
| PATCH  | /inventory/:productId/thresholds  | Admin, Manager  |

### Reports (Admin/Manager only)
| Method | Path                    |
|--------|-------------------------|
| GET    | /reports/sales-summary  |
| GET    | /reports/top-products   |
| GET    | /reports/daily-sales    |

---

## RBAC Matrix

| Action               | Admin | Manager | Cashier |
|----------------------|-------|---------|---------|
| Create/delete users  | ✅    | ❌      | ❌      |
| Manage products      | ✅    | ✅      | ❌      |
| Process orders       | ✅    | ✅      | ✅      |
| Cancel orders        | ✅    | ✅      | ❌      |
| Adjust inventory     | ✅    | ✅      | ❌      |
| View reports         | ✅    | ✅      | ❌      |

---

## Migrations

```bash
npm run migrate            # Run pending migrations
npm run migrate:rollback   # Rollback last migration
npm run seed               # Seed test data
npm run db:setup           # Migrate + seed in one command
```

To add a new migration: create `src/db/migrations/00N_description.js`
exporting `up(query)` and `down(query)`, then register it in `src/db/migrate.js`.
