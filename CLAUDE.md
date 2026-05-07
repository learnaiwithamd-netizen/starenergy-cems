# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

All commands run from the repo root unless noted.

```bash
# Local dev infrastructure (SQL Server 2022 + Redis)
docker compose up -d

# Install dependencies
pnpm install

# Start all apps in watch mode
pnpm dev

# Build all packages and apps (respects Turborepo dependency order)
pnpm build

# Lint, type-check, test
pnpm lint
pnpm type-check
pnpm test

# Run a single app
pnpm --filter @cems/api dev
pnpm --filter @cems/audit-app dev

# Database (run from packages/db)
pnpm --filter @cems/db db:migrate:dev    # Apply migrations in dev
pnpm --filter @cems/db db:generate       # Regenerate Prisma client after schema change
pnpm --filter @cems/db db:studio         # Open Prisma Studio

# Python calc service (run from apps/calc-service)
uvicorn app.main:app --reload            # Dev server on :8000
pytest                                   # Run tests

# Schema parity check (Pydantic ↔ Zod drift gate)
bash scripts/check-calc-schemas.sh
```

## Architecture

Turborepo monorepo with pnpm workspaces. `apps/*` and `packages/*` are workspace members; packages must be built before apps (Turbo enforces this via `"dependsOn": ["^build"]`).

### Apps

| App | Stack | Port | Purpose |
|-----|-------|------|---------|
| `apps/api` | Fastify 5 + Node 22 | 3001 | REST API, OpenAPI docs at `/api/v1/docs` |
| `apps/calc-service` | FastAPI + Python 3.12 | 8000 | Emissions calculation microservice |
| `apps/audit-app` | React 19 + Vite | 5174 | Mobile-first auditor PWA |
| `apps/admin-app` | React 19 + Vite | 5174 | Admin SPA |
| `apps/client-portal` | React 19 + Vite | 5174 | Read-only client dashboard |

All three React SPAs share identical tooling: Vite, React Query, React Router v7, Zustand, React Hook Form, Zod, and shadcn/ui components from `@cems/ui`.

### Packages

- **`@cems/types`** — Shared TypeScript types + Zod schemas; consumed by api and all SPAs
- **`@cems/ui`** — shadcn/ui component library; peer-depends on React 19
- **`@cems/db`** — Prisma client (MSSQL adapter), RLS middleware, migrations
- **`@cems/config`** — Shared ESLint flat config, TypeScript presets (`base`, `app`, `server`), Tailwind preset

### Database & RLS

SQL Server 2022 via Prisma with the `@prisma/adapter-mssql` driver. Multi-tenant row-level security is enforced at the query level via `packages/db/src/middleware/rls.js`. Use `withRlsTransaction` for any tenant-scoped writes.

A custom ESLint rule (`no-tenant-raw-prisma` in `packages/config/eslint/rules/`) blocks direct Prisma calls outside the RLS context — CI will fail if this rule fires.

### API Structure (`apps/api/src/`)

- `app.ts` — Fastify app builder (plugins, routes, middleware)
- `routes/` — HTTP handlers
- `services/` — Business logic
- `repositories/` — Data access (always use RLS wrappers)
- `jobs/` — BullMQ queues: `email-notification-low`, `calculation-normal`, `llm-review-normal`, `pdf-generation-normal`
- `middleware/` — JWT auth, RLS context injection, RFC 7807 error handling

Auth uses JWT (HS256) in all environments; production federates to Azure OIDC. Public routes: `/health`, `/db-health`, `/api/v1/docs`, `/auth/login`, `/auth/refresh`.

### Calc Service Schema Parity

The Pydantic v2 models in `apps/calc-service/app/models/` are the source of truth for calculation I/O shapes. Corresponding Zod schemas live in `@cems/types`. A CI job (`calc-schema-parity` in `.github/workflows/ci.yml`) runs `scripts/compare-zod-shape.mjs` to detect drift — any mismatch blocks merge. When changing calc endpoints, update **both** the Pydantic model and the Zod schema together.

### Infrastructure

Azure-hosted (canadacentral). IaC is Bicep in `infra/bicep/`. Three environments: `dev`, `staging`, `prod`. Prod deploys are manual (`workflow_dispatch`) with an approval gate. The API deploys via slot-swap (zero-downtime); SPAs deploy to Azure Static Web Apps.

## Environment Variables

Copy `.env.example` to `.env`. Required locals: `SA_PASSWORD` (SQL Server), `JWT_SECRET`, `DATABASE_URL`, `REDIS_URL`. `ANTHROPIC_API_KEY` and `CALC_SERVICE_URL` are needed for LLM-review jobs and calc integration respectively.
