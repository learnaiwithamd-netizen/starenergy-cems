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
pnpm lint                 # SPAs enforce --max-warnings=0 (jsx-a11y zero tolerance)
pnpm type-check
pnpm test                 # Vitest across all packages (jsdom for SPAs, axe scan on App)

# Playwright visual-regression (5 viewports per SPA)
pnpm playwright:install   # First-time only — downloads Chromium + system deps
pnpm --filter audit-app exec playwright test
pnpm --filter audit-app exec playwright test --update-snapshots   # Refresh baselines

# Run a single app
pnpm --filter @cems/api dev
pnpm --filter audit-app dev          # :5173
pnpm --filter admin-app dev          # :5174
pnpm --filter client-portal dev      # :5175

# Database (run from packages/db)
pnpm --filter @cems/db db:migrate:dev    # Apply migrations in dev
pnpm --filter @cems/db db:generate       # Regenerate Prisma client after schema change
pnpm --filter @cems/db db:studio         # Open Prisma Studio
pnpm --filter @cems/db db:seed:test-users  # Seed admin/auditor/client into tenant-dev (DEV ONLY)

# Local auth — three default users seeded by db:seed:test-users (tenant `tenant-dev`):
#   admin@cems.local      ADMIN     password123!
#   auditor@cems.local    AUDITOR   password123!
#   client@cems.local     CLIENT    password123!  (assignedStoreIds: ["store-001"])
# Login example:
#   curl -sS http://localhost:3001/api/v1/auth/login \
#     -H 'Content-Type: application/json' \
#     -d '{"email":"auditor@cems.local","password":"password123!"}'

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
| `apps/audit-app` | React 19 + Vite | 5173 | Mobile-first auditor PWA |
| `apps/admin-app` | React 19 + Vite | 5174 | Admin SPA |
| `apps/client-portal` | React 19 + Vite | 5175 | Read-only client dashboard |

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

### Accessibility & Visual Regression Gates

CI fails on any of these (introduced in Story 0.8):

- **axe-core scans** — `vitest-axe` runs `expect(await axe(container)).toHaveNoViolations()` on each SPA's `App.test.tsx`. Add a route-level a11y test for every new route. Color-contrast checks are disabled in jsdom; Playwright covers contrast at real viewports.
- **`eslint-plugin-jsx-a11y` with `--max-warnings=0`** — wired in `packages/config/eslint/index.js` as `rules.reactA11y`; consumed by every SPA's flat config. Any warning fails CI.
- **Skip-to-main-content link** — every SPA's root `App.tsx` renders `<a href="#main-content" class="sr-only focus:not-sr-only ...">` as the first focusable element; `<main id="main-content" tabIndex={-1}>` is the landmark. Verified by Vitest + Playwright tests.
- **Playwright visual regression at 5 viewports** — 375 / 390 / 768 / 1024 / 1280. Baselines committed under `apps/<each>/tests/e2e/__screenshots__/`. Snapshot path is platform-agnostic; pixel diff tolerance is `maxDiffPixelRatio: 0.05`.

If a Playwright failure is a legitimate UI change (not a regression), regenerate baselines locally with `pnpm --filter <app> exec playwright test --update-snapshots` and commit the updated `__screenshots__/`. The CI job uploads `playwright-report/**` as a workflow artifact on failure for diff inspection.

### Infrastructure

Azure-hosted (canadacentral). IaC is Bicep in `infra/bicep/`. Three environments: `dev`, `staging`, `prod`. Prod deploys are manual (`workflow_dispatch`) with an approval gate. The API deploys via slot-swap (zero-downtime); SPAs deploy to Azure Static Web Apps.

## Environment Variables

Copy `.env.example` to `.env`. Required locals: `SA_PASSWORD` (SQL Server), `JWT_SECRET`, `DATABASE_URL`, `REDIS_URL`. `ANTHROPIC_API_KEY` and `CALC_SERVICE_URL` are needed for LLM-review jobs and calc integration respectively.

**API CORS** (Story 1.2): `CORS_ORIGINS` is a comma-separated allowlist (e.g., `https://audit.cems.starenergy.ca,https://admin.cems.starenergy.ca,https://portal.cems.starenergy.ca`). Falls back to localhost:5173/5174/5175 in dev. **No wildcard fallback in prod** — set the env var or CORS will reject every cross-origin request.

**Per-SPA URLs** (consumed by cross-surface redirects when a user logs into the wrong SPA for their role):

```
VITE_API_BASE_URL=http://localhost:3001
VITE_AUDIT_APP_URL=http://localhost:5173
VITE_ADMIN_APP_URL=http://localhost:5174
VITE_CLIENT_PORTAL_URL=http://localhost:5175
```

**API server-side surface URLs** (Story 1.3 — used to build the welcome-email password-set link; no `VITE_` prefix because they're read by Node, not the SPA bundler):

```
AUDIT_APP_URL=http://localhost:5173
ADMIN_APP_URL=http://localhost:5174
CLIENT_PORTAL_URL=http://localhost:5175
```

## Admin User Management (Story 1.3)

- Admins can create, edit, deactivate, and list **auditor + client accounts** via:
  - `POST /api/v1/users` (role: AUDITOR or CLIENT; both can carry `assignedStoreIds: string[]` per Story 2.1's dual-semantics decision)
  - `GET /api/v1/users?role=AUDITOR|CLIENT&status=…` (RLS scopes to admin's tenant)
  - `PATCH /api/v1/users/:id` (name / email / status / assignedStoreIds). Setting `status: INACTIVE` atomically deletes every `user_sessions` row for the user.
- Admin UI lives at `apps/admin-app` `/users` (under `RequireAuth`) with role tabs (Auditors/Clients).
- **`User.assignedStoreIds` dual semantics (Story 2.1):** AUDITOR rows use the column for **UX scoping** (filters the `/api/v1/stores?assignedToUser=true` list). CLIENT rows use it for **security gating** (Azure SQL RLS predicate `fn_audits_filter` consults it only for CLIENT). ADMIN ignores it (sees all via OR-ADMIN). Same column, role-dispatched meaning. The 1.4 cross-field refine that rejected non-empty AUDITOR storeIds was dropped in 2.1.
- Welcome-email link is **role-aware** (Story 1.4): AUDITOR → `${AUDIT_APP_URL}/set-password?token=…`, CLIENT → `${CLIENT_PORTAL_URL}/set-password?token=…`. The user sets their initial password via `POST /api/v1/auth/password-set`. Token TTL: 24h, one-shot.
- INACTIVE users: `login` returns the same generic 401 as wrong-password (with timing parity via dummy argon2 verify); `/me` returns 401 so the SPA clears its session within one request.
- **`assignedStoreIds` JWT staleness (Story 1.4)**: the JWT carries the assignment list at issue-time. Updates take effect on the user's next API call AT MOST one access-token TTL (4h) later. `/me` returns the LIVE DB value (not the JWT claim) so SPAs can detect drift and trigger a silent refresh.
- `GET /api/v1/audits` is a **stub** added in Story 1.4 to validate the RLS audits filter end-to-end. Epic 2 / Story 7.1 ship the full feature. Response shape (`{ audits: AuditListItem[], total }`) is forward-compatible.
- Email job is **stub-only** until Story 5.5 — `cems-email-notification-low` is enqueued with `templateId: 'auditor-welcome'` or `'client-welcome'`, but no actual Resend send happens yet.

## Store Reference Data (Story 2.1)

- `GET /api/v1/stores?assignedToUser=true|false&search=…` — auth required (any role); RLS scopes to tenant. `assignedToUser=true` filters by `rlsContext.assignedStoreIds` for AUDITOR + CLIENT; ADMIN ignores it.
- `search` query is currently a no-op at the API layer; the SPA filters client-side. Future server-side opt-in is forward-compatible (the schema already accepts it).
- Response: `{ stores: StoreSummary[], total }` capped at 200 rows. Pagination ships with the admin queue work.
- audit-app `/` route renders `StoreSelectorPage` (replaces the placeholder Home). Skeleton loading via `@cems/ui` Skeleton, empty state ("No stores assigned — contact your administrator"), client-side debounced search, tap-to-navigate to `/audit/new?storeNumber=…` (placeholder until Story 2.2).
- Seed script (`pnpm --filter @cems/db db:seed:test-users`) inserts 5 sample stores (`STORE-001` to `STORE-005`) and assigns the first 2 to the test auditor + test client.
- No Redis caching at the list endpoint — the architecture's `store_ref:{storeNumber}` 1h cache applies only to the GET-by-storeNumber endpoint (Story 2.2).

## Auth Flow (Story 1.1 + 1.2)

- **API endpoints**: `POST /api/v1/auth/{login,refresh,logout}`, `GET /api/v1/me`. Login returns `{ accessToken, refreshToken, tokenType, expiresIn }`. Access tokens are HS256 JWTs with role-specific TTL (Auditor 8h, Admin/Client 4h) and `iss=cems` / `aud=cems-api`. Refresh tokens are 64-byte secrets; only their SHA-256 hash is persisted.
- **Role guard**: per-route `requireRole([UserRole.ADMIN])` pre-handler; rejects mismatched callers with RFC 7807 403 `…/forbidden`.
- **SPA storage**: access token in memory (Zustand), refresh token in `localStorage` under key `cems.refreshToken`. Each SPA's api-client retries 401-token-expired ONCE via `/auth/refresh`; concurrent 401s share a single in-flight refresh.
- **Cross-surface redirect**: logging into the wrong SPA discards the just-issued tokens (calls `/auth/logout` + clears localStorage) and `window.location.assign`s to the correct surface's `/login`.
- **Synthetic test route**: `GET /api/v1/_test/admin-only` exists when `NODE_ENV !== 'production'` for AC5 verification only — replaced by real ADMIN routes in Story 1.3.

## Store Reference Data (Story 2.1)

- `GET /api/v1/stores` — Returns `{ stores: StoreSummary[], total }` (capped at 200 rows; pagination deferred).
  - Query params: `assignedToUser` (coerced boolean, default `false`), `search` (max 128 chars, **accepted but ignored at API level** — filtering is client-side by design).
  - **ADMIN**: `assignedToUser` flag is always ignored; returns full tenant store list.
  - **AUDITOR/CLIENT**: `assignedToUser=true` restricts to `rlsContext.assignedStoreIds`; empty assignment list short-circuits before the DB call (returns `[]` without a query).
- `StoreSummary` shape: `{ id, storeNumber, storeName: string|null, banner: string|null, region: string|null }`.
- audit-app **Store Selector** (`/` after auth): calls `GET /api/v1/stores?assignedToUser=true`, filters client-side (150 ms debounce, case-insensitive match on `storeNumber` or `storeName`), navigates to `/audit/new?storeNumber=…` on row select.
- `/audit/new` is a **stub** — store auto-fill + DRAFT audit creation arrives in Story 2.2.

## API Testing Pattern

Every feature is tested at three isolated layers (mock the layer below, never the DB directly):

1. **Route tests** (`.routes.test.ts`) — mock the service; verify HTTP status codes, query-param coercion, role guards.
2. **Service tests** (`.service.test.ts`) — mock the repository; verify business-logic branches (e.g. ADMIN ignores `assignedToUser`, empty `ids` short-circuit).
3. **Repo tests** (`.repo.test.ts`) — mock the Prisma transaction object; verify correct `where` clauses and early-return guards.

Run a single test file: `pnpm --filter @cems/api exec vitest run src/routes/stores.routes.test.ts`

## SPA Feature Structure

Each feature lives under `apps/<spa>/src/features/<feature>/` and co-locates its React Query hooks:

```
features/store-selector/
  StoreSelectorPage.tsx      # UI component
  stores-api.ts              # useAssignedStores() hook — queryKey + apiFetch
  StoreSelectorPage.test.tsx # Vitest + vitest-axe (loading / empty / list / search / nav)
```

Hooks follow the pattern: `useQuery<ResponseType>({ queryKey: [...KEY, params], queryFn: () => apiFetch('/api/v1/...'), staleTime })`. Store list uses `staleTime: 5 * 60 * 1000`; adjust per data volatility.
