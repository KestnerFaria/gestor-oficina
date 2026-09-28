# Backend — Gestor de Oficina API

REST API for the multi-tenant auto repair shop SaaS. Express 5 + TypeScript + PostgreSQL.
See the [root README](../README.md) for the full project overview.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Starts the API with hot reload (`tsx watch`) |
| `npm run build` | Compiles TypeScript to `dist/` |
| `npm start` | Runs the compiled API (`node dist/server.js`) |
| `npm run typecheck` | Type-checks without emitting files |
| `npm run migrate` | Applies `migrations/schema.sql` to `DATABASE_URL` |

## Environment variables

Copy `.env.example` to `.env`. **Never commit `.env`.**

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | yes | PostgreSQL connection string |
| `JWT_SECRET` | yes | Long random string used to sign login tokens |
| `PORT` | no | Defaults to `3001` |
| `FRONTEND_URL` | no | Allowed CORS origin |
| `ASAAS_API_KEY` | billing | Asaas API key (sandbox keys start with `$aact_hmlg_`) |
| `ASAAS_BASE_URL` | billing | `https://api-sandbox.asaas.com/v3` or the production URL |
| `ASAAS_WEBHOOK_TOKEN` | billing | Token configured in the Asaas webhook panel |
| `VALOR_MENSALIDADE` | no | Monthly subscription price in BRL |

## Quick test

```bash
# create a workshop (returns a token)
curl -X POST http://localhost:3001/auth/cadastrar-oficina \
  -H "Content-Type: application/json" \
  -d '{"nomeOficina":"Oficina Teste","cnpj":"00000000000191","telefone":"11999990000","nomeUsuario":"Admin","email":"admin@teste.com","senha":"123456"}'

# log in
curl -X POST http://localhost:3001/auth/login-equipe \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@teste.com","senha":"123456"}'
```

Send the returned token as `Authorization: Bearer <token>` on every other request.

## Main endpoints

| Resource | Routes |
|---|---|
| Auth | `POST /auth/cadastrar-oficina`, `/auth/login-equipe`, `/auth/login-cliente` |
| Workshop & billing | `GET/PUT /oficinas/minha`, `/oficinas/minha/assinatura[/cobrancas\|/configurar\|/cancelar]` |
| Team | `GET/POST /equipe`, `DELETE /equipe/:id` |
| Customers, vehicles, services, parts | CRUD on `/clientes`, `/veiculos`, `/servicos`, `/produtos` |
| Service orders | `GET/POST /ordens`, `PATCH /ordens/:id/{status,mecanico,observacoes,sinal}`, `POST /ordens/:id/finalizar` |
| Payments & expenses | `/pagamentos`, `/despesas` |
| Customer portal | `GET /portal/minhas-ordens`, `/portal/meus-pagamentos` |
| Other | `/auditoria`, `/alertas-whatsapp`, `POST /webhooks/asaas` |

## Deploy (Railway)

Railway runs `npm install`, `npm run build` and `npm start` automatically. Set the environment variables in the service settings and make sure the service **root directory** is `backend`.

## Known MVP limitations

- Logos and payment receipts are stored as base64 in the database — move to object storage (S3, R2, Supabase).
- No request schema validation (e.g. Zod) or rate limiting yet.
