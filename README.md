# Gestor de Oficina — Auto Repair Shop Management SaaS

A multi-tenant SaaS for Brazilian auto repair shops (*oficinas mecânicas*), running in production with recurring billing.
Each shop gets its own isolated workspace to manage customers, vehicles, service orders, inventory, payments and its team.

![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6)
![React](https://img.shields.io/badge/React-19-61DAFB)
![Node.js](https://img.shields.io/badge/Node.js-Express%205-339933)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1)

## Features

- **Multi-tenant by design** — every query is scoped to the workshop from the JWT, never from the request body
- **Role-based access** — `admin`, `atendente` (front desk) and `mecanico` (mechanic), plus a separate customer portal login
- **Service orders (O.S.)** — full workflow from quote to delivery, with prices always computed on the server
- **Inventory** — stock is deducted automatically by a database trigger when parts are added to an order, and returned if the order is deleted
- **Payments & expenses** — partial payments (deposit + balance), receipts, refunds and monthly fixed expenses
- **Customer portal** — customers log in to follow their own orders and payments
- **WhatsApp return reminders** — one click to contact customers due for their next service
- **Audit log** — who did what, and when, for every data change
- **SaaS billing** — 10-day free trial and monthly subscription via the [Asaas](https://www.asaas.com) API (Pix, boleto or card), with webhook-driven status and automatic access blocking when overdue

## Tech stack

| Layer | Tech |
|---|---|
| Frontend | React 19, Vite, TypeScript (gradual migration) |
| Backend | Node.js, Express 5, TypeScript (strict) |
| Database | PostgreSQL (triggers, enums, views) |
| Auth | JWT + bcrypt |
| Payments | Asaas REST API + webhooks |
| Hosting | Vercel (frontend), Railway (API + database) |
| CI | GitHub Actions (type check + build) |

## Architecture

```
┌──────────────┐  HTTPS/JSON   ┌────────────────────┐        ┌──────────────┐
│ React (Vite) │ ─────────────▶│  Express 5 API     │ ──────▶│  PostgreSQL  │
│   Vercel     │  Bearer JWT   │  Railway           │        │  (triggers)  │
└──────────────┘               │  requireAuth →     │        └──────────────┘
                               │  role guards →     │
                               │  tenant-scoped SQL │◀─────── Asaas webhooks
                               └────────────────────┘ ──────▶ Asaas API
```

```
.
├── backend/
│   ├── migrations/schema.sql   # tables, enums, triggers, views
│   └── src/
│       ├── server.ts           # app setup and route mounting
│       ├── middleware/auth.ts  # JWT, role guards, subscription gate
│       ├── routes/             # one router per resource
│       ├── asaas.ts            # billing integration
│       └── utils/
└── frontend/
    └── src/
        ├── api.ts              # typed API client
        └── OficinaApp.jsx      # UI (being migrated to .tsx)
```

## Running locally

**Requirements:** Node.js 20+ and PostgreSQL.

```bash
# 1. API
cd backend
cp .env.example .env        # fill in DATABASE_URL and JWT_SECRET
npm install
npm run migrate             # creates the schema
npm run dev                 # http://localhost:3001

# 2. Web app (in another terminal)
cd frontend
cp .env.example .env.local  # VITE_API_URL=http://localhost:3001
npm install
npm run dev                 # http://localhost:5173
```

## Engineering notes

A few problems solved along the way:

- **NUMERIC as text** — `pg` returns `NUMERIC` columns as strings to avoid precision loss, so `0 + "120.00"` became `"0120.00"` in the UI. Fixed with a custom type parser. `DATE` columns get the same treatment, returning plain `YYYY-MM-DD`.
- **Order numbering** — sequential per workshop. The original `COUNT(*) + 1` reused numbers after a deletion and violated the unique constraint; it now uses `MAX + 1` under a transaction-level advisory lock.
- **Async errors** — upgrading to Express 5 routes rejected promises to the error handler instead of crashing the process.
- **Tenant isolation** — foreign keys sent by the client (customer, vehicle, parts) are verified to belong to the caller's workshop before use.
- **Idempotent billing setup** — if Asaas is unavailable at sign-up, the account still works and the admin can retry billing setup later.

## Roadmap

- [ ] Finish migrating `OficinaApp.jsx` into typed `.tsx` components
- [ ] Automated tests (Vitest + Supertest)
- [ ] Request validation with Zod and rate limiting
- [ ] Move logos and receipts from base64 to object storage

## Author

**Kestner Faria** — full-stack developer · [GitHub](https://github.com/KestnerFaria)
