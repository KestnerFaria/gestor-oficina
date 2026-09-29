# Gestor de Oficina — Auto Repair Shop Management SaaS

A multi-tenant SaaS for Brazilian auto repair shops (*oficinas mecânicas*), running in production with recurring billing.
Each shop gets its own isolated workspace to manage customers, vehicles, service orders, inventory, payments and its team.

![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6)
![React](https://img.shields.io/badge/React-19-61DAFB)
![Node.js](https://img.shields.io/badge/Node.js-Express%205-339933)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1)
![CI](https://github.com/KestnerFaria/gestor-oficina/actions/workflows/ci.yml/badge.svg)

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
| Frontend | React 19, Vite, TypeScript (strict) |
| Backend | Node.js, Express 5, TypeScript (strict) |
| Database | PostgreSQL (triggers, enums, views) |
| Auth | JWT + bcrypt |
| Payments | Asaas REST API + webhooks |
| Hosting | Vercel (frontend), Railway (API + database) |
| Tests | Backend: Vitest + Supertest against a real PostgreSQL (64 tests). Frontend: Vitest + Testing Library, from pure business rules to full-app flows with a simulated server (100 tests) |
| CI | GitHub Actions (type check, tests, lint, build) |

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
│   ├── tests/                  # integration tests (Vitest + Supertest)
│   └── src/
│       ├── app.ts              # Express app and route mounting
│       ├── server.ts           # env checks + listen
│       ├── middleware/auth.ts  # JWT, role guards, subscription gate
│       ├── routes/             # one router per resource
│       ├── asaas.ts            # billing integration
│       └── utils/
└── frontend/
    └── src/
        ├── OficinaApp.tsx      # root: login, session and which area to show
        ├── api.ts              # typed API client
        ├── hooks/              # session, data loading and API actions
        ├── pages/              # one file per screen (ordens/ for service orders)
        ├── components/ui/      # shared UI pieces (Badge, Field, modal...)
        ├── regras/             # business rules as pure, tested functions
        └── utils/              # dates, errors, file reading
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

### Running the tests

The backend has integration tests that hit a real PostgreSQL database. Create an empty database whose name contains `test` (the suite refuses any other name, since it wipes all tables):

```bash
createdb oficina_test
cd backend
TEST_DATABASE_URL=postgresql://user:pass@localhost:5432/oficina_test npm test
```

## Engineering notes

A few problems solved along the way:

- **NUMERIC as text** — `pg` returns `NUMERIC` columns as strings to avoid precision loss, so `0 + "120.00"` became `"0120.00"` in the UI. Fixed with a custom type parser. `DATE` columns get the same treatment, returning plain `YYYY-MM-DD`.
- **Order numbering** — sequential per workshop. The original `COUNT(*) + 1` reused numbers after a deletion and violated the unique constraint; it now uses `MAX + 1` under a transaction-level advisory lock.
- **Async errors** — upgrading to Express 5 routes rejected promises to the error handler instead of crashing the process.
- **Tenant isolation** — foreign keys sent by the client (customer, vehicle, parts) are verified to belong to the caller's workshop before use.
- **Idempotent billing setup** — if Asaas is unavailable at sign-up, the account still works and the admin can retry billing setup later.
- **Frozen prices** — each service order stores the price of every item on the day it was opened. The screens used to look up today's catalog price, so a price change rewrote old orders; they now read the stored price.
- **Time zones** — "today" was computed with `toISOString()` (UTC), so after 9 PM in Brazil the app already thought it was tomorrow. Dates now use the local time zone and are tested with a fake clock.
- **Component identity** — a component declared inside another was recreated on every keystroke, so inputs lost focus after one letter. Caught by an interaction test that types like a real user.
- **Safe refactoring** — the 3,000-line UI was split in small PRs; for each one, the same tests were run against the old and the new code to prove behavior did not change.

## Roadmap

- [x] Frontend fully migrated to TypeScript, from one 3,000-line file to typed components
- [x] Automated tests for backend and frontend, running in CI
- [ ] Request validation with Zod and rate limiting
- [ ] Move logos and receipts from base64 to object storage

## Author

**Kestner Faria** — full-stack developer · [GitHub](https://github.com/KestnerFaria)

<img width="1912" height="1006" alt="Tela OS" src="https://github.com/user-attachments/assets/4114dfd4-94ce-4660-8f24-483dbb753a5c" />
<img width="1907" height="987" alt="Tela inicial" src="https://github.com/user-attachments/assets/61419a79-c918-4c8a-aafd-3903a42b0563" />
<img width="1896" height="1010" alt="Tela da oficina" src="https://github.com/user-attachments/assets/24d5e780-acf6-4a43-8351-ceaf1e546bd1" />
<img width="1272" height="790" alt="Servicos e estoques" src="https://github.com/user-attachments/assets/9e5ff1a2-b68a-4eb5-b757-6cc3eee69991" />
<img width="1272" height="880" alt="Nova OS" src="https://github.com/user-attachments/assets/d3a224ab-80be-43e4-b836-97e3d185eb5c" />
<img width="1307" height="792" alt="Financeiro" src="https://github.com/user-attachments/assets/18c8db35-cb01-4a30-a364-0bb06ec12d41" />
<img width="1272" height="810" alt="Despesas da oficina" src="https://github.com/user-attachments/assets/ee9d1888-001a-43a9-a761-4c10496a1360" />
<img width="1262" height="797" alt="Dados da oficina" src="https://github.com/user-attachments/assets/7e865b74-d25a-42e5-ab5a-ed2e9bca50d9" />
<img width="1257" height="792" alt="Clientes e veiculos" src="https://github.com/user-attachments/assets/b60ae8bd-f6a5-47b3-a1b4-31cb2bfbe0a9" />

