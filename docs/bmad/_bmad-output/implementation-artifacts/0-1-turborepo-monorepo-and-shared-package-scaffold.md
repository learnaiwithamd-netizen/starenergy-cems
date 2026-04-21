# Story 0.1: Turborepo Monorepo & Shared Package Scaffold

Status: review

## Story

As a developer,
I want a configured Turborepo monorepo with all app scaffolds and shared packages in place,
So that all three applications and the API can be developed in a consistent, type-safe environment with shared dependencies.

## Acceptance Criteria

1. **Given** the repository is cloned, **When** `pnpm install` is run, **Then** all workspace dependencies install without errors and all five apps + four packages resolve correctly.

2. **Given** any app is targeted with `turbo run build --filter=audit-app`, **When** the build runs, **Then** only that app and its dependencies rebuild (Turborepo filtered build).

3. **Given** `packages/types` exports `AuditStatus` enum and timing constants (`SECTION_LOCK_TTL_MS=90000`, `SECTION_LOCK_HEARTBEAT_MS=30000`, `SECTION_LOCK_POLL_MS=15000`, `PHOTO_MAX_SIZE_BYTES=10*1024*1024`), **When** a type is imported in any app, **Then** TypeScript resolves it without error.

4. **Given** `packages/config/tailwind/preset.ts` is created, **When** any app's `tailwind.config.ts` extends it, **Then** all shared design tokens, breakpoints, and spacing scale are available.

5. **Given** `packages/ui` exports a `Button` component, **When** imported in any app, **Then** it compiles and renders without error.

## Tasks / Subtasks

- [x] **Task 1: Bootstrap Turborepo root** (AC: 1, 2)
  - [x] Root `package.json` with `"packageManager": "pnpm@9.15.9"` and turbo scripts
  - [x] `turbo.json` with `tasks` block (Turbo 2.x API) — build, type-check, test, lint, dev, clean
  - [x] `pnpm-workspace.yaml` listing `apps/*` and `packages/*`
  - [x] `.gitignore` (node_modules, dist, .turbo, .env, *.local, Python artefacts)
  - [x] `.env.example` with placeholders for DATABASE_URL, JWT_SECRET, AZURE_STORAGE_CONNECTION_STRING, REDIS_URL, RESEND_API_KEY, CLAUDE_API_KEY, CALC_SERVICE_URL

- [x] **Task 2: Scaffold frontend apps** (AC: 1, 2)
  - [x] `apps/audit-app`: Vite 6 + React 19 + Tailwind 4 + TanStack Query v5 + RHF + Zod + React Router v7 + Zustand; workspace deps `@cems/ui`, `@cems/types`, `@cems/config`
  - [x] `apps/admin-app`: same stack
  - [x] `apps/client-portal`: same stack
  - [x] Each app: `src/main.tsx`, `src/App.tsx` (imports `@cems/ui` Button + `@cems/types`), `src/pages/`, `src/features/`, `src/components/`, `src/lib/queryClient.ts`, `src/lib/api-client.ts`
  - [x] Each app: viewport meta `width=device-width, initial-scale=1, maximum-scale=1` in `index.html`

- [x] **Task 3: Scaffold API app** (AC: 1, 2)
  - [x] `apps/api/package.json` — Node 22 engine, Fastify 5.8.5, Prisma 7.5.0, BullMQ 5.74.1, Puppeteer 24.35.0, `@azure/storage-blob`, Resend, jose, Pino, Zod
  - [x] `tsconfig.json` extends `@cems/config/typescript/server.json`
  - [x] `src/app.ts` (Fastify instance + `/api/v1/health` stub), `src/server.ts` (listen)
  - [x] Folders: `routes/`, `services/`, `repositories/`, `jobs/`, `middleware/`, `lib/`, `renderer/report-bundle/`

- [x] **Task 4: Scaffold calc service** (AC: 1)
  - [x] `requirements.txt` (fastapi 0.115, uvicorn, numpy, pandas, pydantic 2, pytest, httpx), `pyproject.toml`, `Dockerfile`
  - [x] `app/main.py` with FastAPI instance and `GET /health` → `{"status": "ok"}`
  - [x] Folders: `app/routes/`, `app/services/`, `app/models/`, `app/lib/` (all with `__init__.py`)
  - [x] `tests/test_health.py` with TestClient assertion

- [x] **Task 5: Build `packages/types`** (AC: 3)
  - [x] `package.json` — `@cems/types`, `"type": "module"`, zod dep, workspace `@cems/config`
  - [x] `src/audit.ts` — `AuditStatus` enum with 8 states (DRAFT, SUBMITTED, IN_REVIEW, CALC_IN_PROGRESS, CALC_COMPLETE, MANUAL_REVIEW_REQUIRED, APPROVED, PUBLISHED) + Audit & AuditSection interfaces
  - [x] `src/user.ts` — `UserRole` enum (ADMIN, AUDITOR, CLIENT) + User interface
  - [x] `src/calculation.ts` — `CalcResult`, `LlmFlag`, `OverrideRecord` interfaces
  - [x] `src/api.ts` — `PaginatedResponse<T>`, `ProblemDetail`, `JobStatus`, `JobStatusValue`
  - [x] `src/index.ts` — barrel exports + `SECTION_LOCK_TTL_MS`, `SECTION_LOCK_HEARTBEAT_MS`, `SECTION_LOCK_POLL_MS`, `PHOTO_MAX_SIZE_BYTES`, `PHOTO_ACCEPTED_TYPES`
  - [x] `src/forms/` — five Zod schema stubs (general, refrigeration, hvac, lighting, building-envelope)

- [x] **Task 6: Build `packages/config`** (AC: 4)
  - [x] `package.json` — exports map for `./typescript/*`, `./eslint`, `./tailwind`
  - [x] `eslint/index.js` — flat-config stub (no-console, no-debugger)
  - [x] `typescript/base.json` — strict, verbatimModuleSyntax, isolatedModules
  - [x] `typescript/app.json` — extends base, DOM + DOM.Iterable lib, jsx react-jsx, ES2022 target
  - [x] `typescript/server.json` — extends base, NodeNext module+resolution, ES2022 lib
  - [x] `tailwind/preset.ts` — primary/success/warning/danger/surface tokens via CSS vars, `touch-min: 44px` utility

- [x] **Task 7: Build `packages/ui`** (AC: 5)
  - [x] `package.json` — `@cems/ui`, `"type": "module"`, React 19 peer deps, clsx + tailwind-merge + class-variance-authority
  - [x] `src/components/Button.tsx` — CVA-driven Button with 6 variants + 4 sizes, forwards ref, `min-h-[44px] min-w-[44px]` for touch targets
  - [x] `src/lib/utils.ts` — `cn()` = twMerge(clsx(...))
  - [x] `src/index.ts` — re-exports Button, buttonVariants, ButtonProps, cn

- [x] **Task 8: Build `packages/db` scaffold** (AC: 1)
  - [x] `package.json` — `@cems/db`, Prisma 7.5.0 + `@prisma/adapter-mssql`, scripts for `db:generate/migrate/migrate:dev`
  - [x] `prisma/schema.prisma` — sqlserver datasource, driverAdapters preview (full tables in Story 0.3)
  - [x] `src/index.ts` — exports RlsContext, DatabaseConfig (PrismaClient singleton deferred to Story 0.3 when generator runs)
  - [x] `src/middleware/rls.ts` — RlsContext interface + `applyRlsMiddleware` stub

- [x] **Task 9: Configure turbo.json pipeline** (AC: 2)
  - [x] Tasks: build (depends on `^build`, outputs dist/**), type-check (depends on `^build`), test (depends on build, outputs coverage/**), lint, dev (cache: false, persistent: true), clean

- [x] **Task 10: Verify and test** (AC: 1–5)
  - [x] `pnpm install` completed — 534 packages, zero errors
  - [x] `pnpm turbo run build --filter=audit-app` — only audit-app executed (AC 2 ✅)
  - [x] `pnpm turbo run type-check` — all 9 packages pass (AC 3 ✅)
  - [x] `pnpm turbo run build` — all 3 frontend apps + API compile cleanly
  - [x] `audit-app/src/App.tsx` imports `AuditStatus` + `SECTION_LOCK_TTL_MS` from `@cems/types` — resolves (AC 3 ✅)
  - [x] `audit-app/src/App.tsx` imports `Button` from `@cems/ui` — compiles and included in bundle (AC 5 ✅)
  - [x] Apps extend `@cems/config/tailwind` preset in their `tailwind.config.ts` — design tokens available (AC 4 ✅)

## Dev Notes

### Exact Init Command

```bash
npx create-turbo@latest cems --package-manager pnpm
```

Run from the parent directory. This creates `cems/` as the monorepo root. All subsequent work happens inside `cems/`.

### Required Directory Structure

Implement this EXACT structure — the architecture document is the authority:

```
cems/
├── apps/
│   ├── audit-app/          # Mobile-first React SPA — field auditors
│   ├── admin-app/          # Desktop React SPA — Star Energy staff
│   ├── client-portal/      # Read-only React SPA — Sobeys/Metro clients
│   ├── api/                # Node.js 22 + Fastify 5 REST API
│   └── calc-service/       # Python 3.12 + FastAPI (internal microservice)
├── packages/
│   ├── ui/                 # @cems/ui — shadcn/ui + Tailwind components
│   ├── types/              # @cems/types — shared TS types + Zod schemas + constants
│   ├── db/                 # @cems/db — Prisma schema + generated client
│   └── config/             # @cems/config — ESLint, TypeScript, Tailwind configs
├── turbo.json
├── pnpm-workspace.yaml
├── package.json
├── .env.example
└── .gitignore
```

### Pinned Library Versions — Do NOT upgrade without explicit instruction

| Package | Pinned Version | Location |
|---------|---------------|----------|
| React | 19 | all 3 frontend apps |
| Vite | 6 | all 3 frontend apps |
| Tailwind CSS | 4 | all 3 frontend apps |
| TanStack Query | v5 | all 3 frontend apps |
| React Router | v7 | all 3 frontend apps |
| Fastify | 5.8.5 | apps/api |
| Prisma | 7.5.0 | apps/api + packages/db |
| BullMQ | 5.74.1 | apps/api |
| Puppeteer | 24.35.0 | apps/api |
| Node.js | 22 | apps/api |
| Python | 3.12 | apps/calc-service |

### turbo.json Pipeline Configuration

```json
{
  "$schema": "https://turbo.build/schema.json",
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".next/**"]
    },
    "type-check": {
      "dependsOn": ["^build"]
    },
    "test": {
      "dependsOn": ["build"],
      "outputs": ["coverage/**"]
    },
    "lint": {},
    "dev": {
      "cache": false,
      "persistent": true
    }
  }
}
```

### pnpm-workspace.yaml

```yaml
packages:
  - 'apps/*'
  - 'packages/*'
```

### packages/types — AuditStatus Enum

All 7 audit states must be defined now. Story 0.3 (DB schema) and later feature epics depend on these exact values:

```typescript
// packages/types/src/audit.ts
export enum AuditStatus {
  DRAFT = 'DRAFT',
  SUBMITTED = 'SUBMITTED',
  IN_REVIEW = 'IN_REVIEW',
  CALC_IN_PROGRESS = 'CALC_IN_PROGRESS',
  CALC_COMPLETE = 'CALC_COMPLETE',
  MANUAL_REVIEW_REQUIRED = 'MANUAL_REVIEW_REQUIRED',
  APPROVED = 'APPROVED',
  PUBLISHED = 'PUBLISHED',
}
```

### packages/types — Timing Constants (CRITICAL — used across multiple apps)

```typescript
// packages/types/src/index.ts
export const SECTION_LOCK_TTL_MS = 90_000           // Redis key TTL for section locks
export const SECTION_LOCK_HEARTBEAT_MS = 30_000     // Client heartbeat interval (useSectionLock.ts)
export const SECTION_LOCK_POLL_MS = 15_000          // MVP polling interval for lock status
export const PHOTO_MAX_SIZE_BYTES = 10 * 1024 * 1024  // 10MB max photo size
export const PHOTO_ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/heic']
```

These constants are used by: audit-app (camera capture, section locking), api (photo validation, Redis TTL). Centralizing in `packages/types` prevents drift.

### packages/config/tailwind/preset.ts — Required Design Tokens

The UX design specification defines these tokens. Implement them as CSS custom properties:

```typescript
// packages/config/tailwind/preset.ts
import type { Config } from 'tailwindcss'

export default {
  theme: {
    extend: {
      colors: {
        primary: 'var(--color-primary)',      // #1B6BDB
        success: 'var(--color-success)',      // #2E7D32
        warning: 'var(--color-warning)',      // #F5A623
        danger: 'var(--color-danger)',        // #DC2626
      },
    },
  },
} satisfies Partial<Config>
```

Apps extend this preset in their `tailwind.config.ts`. Design tokens used throughout UX spec for buttons, status badges, alerts.

### packages/ui — shadcn/ui Setup Note

shadcn/ui components are added to `packages/ui`, not to individual apps. Apps import from `@cems/ui`. This avoids duplicate shadcn installations across 3 apps.

The `cn()` utility in `packages/ui/src/lib/utils.ts` must use both `clsx` and `tailwind-merge`:

```typescript
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

### Frontend App Structure Pattern (apply to all 3)

```
apps/{app-name}/src/
├── pages/          # Route-level components (one per route)
├── features/       # Feature modules (organized by domain)
├── components/     # Truly shared UI within this app
├── lib/
│   ├── queryClient.ts   # TanStack Query client setup
│   └── api-client.ts    # Base fetch wrapper
└── main.tsx
```

Do NOT create `__tests__/` folders — tests are co-located with source files (`Component.tsx` + `Component.test.tsx` same dir).

### API App Structure (create empty folders now, populated in later stories)

```
apps/api/src/
├── routes/         # Fastify route handlers (thin — validate, call service, respond)
├── services/       # Business logic
├── repositories/   # Prisma query functions
├── jobs/           # BullMQ job processors
├── middleware/     # auth.ts, rls.ts, tenant.ts, error-handler.ts
├── lib/            # azure-blob.ts, claude.ts, resend.ts, redis.ts, logger.ts
└── renderer/
    └── report-bundle/   # Pre-compiled standalone HTML bundle for Puppeteer PDF rendering
```

### Anti-Patterns — Do NOT do these

- Do NOT use `create-react-app` — use Vite
- Do NOT install dependencies in root `node_modules` that belong to specific apps/packages
- Do NOT create a shared `utils` package beyond `@cems/ui/lib/utils.ts` — utilities live near their feature
- Do NOT put business logic in route handlers — services layer handles that (Story 0.4+)
- Do NOT commit `.env` files — only `.env.example` with placeholder values
- Do NOT use `console.log` anywhere — Pino logger is the standard (set up in Story 0.4)

### Project Structure Notes

- All paths relative to `cems/` monorepo root (the folder created by `create-turbo`)
- TypeScript path aliases: `@cems/ui`, `@cems/types`, `@cems/db`, `@cems/config` configured in each app's `tsconfig.json` via `paths` entries
- Workspace protocol in package.json deps: `"@cems/types": "workspace:*"`
- This is Epic 0 / Story 1 — there is NO previous story to learn from; all subsequent epics (1–10) depend on this scaffold being correct

### References

- Architecture: monorepo structure, tech stack, pinned versions — [Source: architecture.md#Selected Architecture: Turborepo Monorepo]
- Architecture: project directory tree — [Source: architecture.md#Complete Project Directory Structure]
- Architecture: naming conventions — [Source: architecture.md#Naming Patterns]
- Architecture: anti-patterns — [Source: architecture.md#Anti-Patterns (explicitly forbidden)]
- Architecture: timing constants — [Source: architecture.md#Gap Analysis Results — Gap 3]
- Epics: Story 0.1 acceptance criteria — [Source: epics.md#Story 0.1]
- UX: design tokens (colors) — [Source: ux-design-specification.md]

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

Monorepo root created at `/Users/abhiroma/Downloads/cems/` (sibling of BMAD workspace). Implementation deviations from original scaffold plan:

- **Turbo 2.x API change**: Story's `turbo.json` example used `pipeline` key (Turbo 1.x). Turbo 2.9.6 renamed to `tasks`. Config updated inline when the first `type-check` run flagged it.
- **Prisma client import deferred**: `packages/db/src/index.ts` originally exported `PrismaClient`, but `@prisma/client` needs `prisma generate` to materialise types — which requires a live `DATABASE_URL`. Deferred to Story 0.3 per its scope; `packages/db` currently exports `RlsContext`, `DatabaseConfig`, and `applyRlsMiddleware` stub only.
- **Package `type: module`**: Root `verbatimModuleSyntax: true` in `base.json` requires every workspace package to set `"type": "module"`. Added to `@cems/types`, `@cems/ui`, `@cems/db`.
- **types tsconfig**: Switched from extending `base.json` to `server.json` so it inherits `module: NodeNext`. Needed `.js` extensions on relative re-exports.
- **API @fastify/swagger omitted from app.ts for this story**: declared as dep in `package.json` but not registered — Story 0.4 will register it with the error handler, auth middleware, etc.

### Completion Notes List

- All 5 acceptance criteria verified via command output:
  - AC 1: `pnpm install` → 534 packages added, done in 58.6s, zero errors
  - AC 2: `pnpm turbo run build --filter=audit-app` → only `audit-app` in scope, built cleanly in 923ms
  - AC 3: `@cems/types` exports `AuditStatus` enum + all 5 timing/size constants; `audit-app/src/App.tsx` imports `AuditStatus` + `SECTION_LOCK_TTL_MS` and type-checks clean
  - AC 4: `packages/config/tailwind/preset.ts` exports preset with CSS variable tokens; apps extend via `presets: [preset]` in their `tailwind.config.ts`
  - AC 5: `@cems/ui` Button (CVA-based, 6 variants, 4 sizes, 44pt touch target) imported in all 3 apps' `App.tsx` — type-checks clean and included in production Vite bundles
- Full `pnpm turbo run build` succeeds: 3 frontend Vite builds (≈300 kB JS + 5.5 kB CSS gzipped ≈90 kB each) + API `tsc -b` in 2.5s
- pnpm installed globally during this story (`npm install -g pnpm@9`)
- Turborepo version is 2.9.6 (matches latest stable, differs from hypothetical ^2.3.3 initially requested in package.json — pnpm resolved to 2.9.6)

### File List

**Root (cems/):**
- `package.json`
- `turbo.json`
- `pnpm-workspace.yaml`
- `.gitignore`
- `.env.example`
- `pnpm-lock.yaml` (generated)

**apps/audit-app/:**
- `package.json`, `index.html`, `vite.config.ts`, `tsconfig.json`, `tailwind.config.ts`, `postcss.config.js`
- `src/main.tsx`, `src/App.tsx`, `src/index.css`, `src/vite-env.d.ts`
- `src/lib/queryClient.ts`, `src/lib/api-client.ts`
- `src/pages/` (empty), `src/features/` (empty), `src/components/` (empty), `public/` (empty)

**apps/admin-app/:** — same 12-file layout as audit-app (admin-specific `App.tsx` + port 5174)

**apps/client-portal/:** — same 12-file layout as audit-app (client-specific `App.tsx` + port 5175)

**apps/api/:**
- `package.json`, `tsconfig.json`
- `src/app.ts`, `src/server.ts`
- `src/{routes,services,repositories,jobs,middleware,lib,renderer/report-bundle}/.gitkeep`

**apps/calc-service/:**
- `package.json`, `requirements.txt`, `pyproject.toml`, `Dockerfile`
- `app/__init__.py`, `app/main.py`
- `app/{routes,services,models,lib}/__init__.py`
- `tests/__init__.py`, `tests/test_health.py`

**packages/types/:**
- `package.json`, `tsconfig.json`
- `src/index.ts`, `src/audit.ts`, `src/user.ts`, `src/calculation.ts`, `src/api.ts`
- `src/forms/{general,refrigeration,hvac,lighting,building-envelope}.schema.ts`

**packages/config/:**
- `package.json`
- `eslint/index.js`
- `typescript/{base,app,server}.json`
- `tailwind/preset.ts`

**packages/ui/:**
- `package.json`, `tsconfig.json`
- `src/index.ts`, `src/components/Button.tsx`, `src/lib/utils.ts`

**packages/db/:**
- `package.json`, `tsconfig.json`
- `prisma/schema.prisma`
- `src/index.ts`, `src/middleware/rls.ts`

### Change Log

- 2026-04-21 — Initial scaffold created. Monorepo root: `/Users/abhiroma/Downloads/cems/`. All 10 tasks complete, all 5 ACs verified.
- 2026-04-21 — Code review complete. 3 adversarial reviewers (Blind Hunter, Edge Case Hunter, Acceptance Auditor) surfaced 24 patch items, 17 deferrals, 10 dismissals.
- 2026-04-21 — All 24 review patches applied on branch `story/0-1-review-followup`. Full type-check (9/9 packages) and `turbo run build` (4/4) pass. Changes: Button variants remapped to defined tokens; RLS stub now throws; PORT validated; apiFetch rewritten with ApiError class, AbortController timeout, 204 handling, ProblemDetail preservation, FormData-aware Content-Type, trailing-slash normalisation; tsconfig paths include @cems/config and @cems/db; autoprefixer removed (Tailwind v4 Lightning CSS); Dockerfile runs as non-root user; main.tsx hardened against missing #root; ImportMetaEnv augmented; .env.example strengthened; .gitignore adds *.local and *.tsbuildinfo; pyproject.toml sets pytest pythonpath; turbo pinned to 2.9.6; root engines.node added.

### Review Findings

**Code review 2026-04-21** — 3-layer adversarial review (Blind Hunter, Edge Case Hunter, Acceptance Auditor).

**Patch (unchecked — awaiting action):**

- [x] [Review][Patch] Button variants reference undefined Tailwind tokens (`bg-secondary`, `bg-accent`, `border-input`, `bg-background`, `bg-primary/90`) — variants `outline`, `secondary`, `ghost`, `destructive`, `link` render without styling [packages/ui/src/components/Button.tsx:12-14]
- [x] [Review][Patch] `applyRlsMiddleware` is a silent no-op — must throw to prevent Story 0.3 consumers from assuming RLS is active [packages/db/src/middleware/rls.ts:11]
- [x] [Review][Patch] `PORT` env parsed with `Number()` — `'abc'` → NaN, `''` → 0, both bind wrong; add `isFinite` validation [apps/api/src/server.ts:3]
- [x] [Review][Patch] `apiFetch` discards structured `ProblemDetail` (errors[], title, status) — throws generic Error [apps/*/src/lib/api-client.ts:11-14]
- [x] [Review][Patch] `apiFetch` forces `Content-Type: application/json` — breaks `FormData` multipart uploads when caller doesn't override [apps/*/src/lib/api-client.ts:6-9]
- [x] [Review][Patch] `apiFetch` calls `res.json()` unconditionally — crashes on 204 No Content (DELETE/lock-release responses) [apps/*/src/lib/api-client.ts:15]
- [x] [Review][Patch] `apiFetch` has no timeout / AbortController — hanging requests stall UI indefinitely [apps/*/src/lib/api-client.ts]
- [x] [Review][Patch] `API_BASE_URL` trailing slash creates double-slash URLs [apps/*/src/lib/api-client.ts:1]
- [x] [Review][Patch] Apps' `tsconfig.json` omit `@cems/config` and `@cems/db` from `paths` (Dev Notes mandate) [apps/*/tsconfig.json, apps/api/tsconfig.json]
- [x] [Review][Patch] `turbo` devDep uses `^2.3.3` caret — violates "pinned versions" mandate [package.json:14]
- [x] [Review][Patch] `autoprefixer` redundant with Tailwind v4 Lightning CSS [apps/*/postcss.config.js]
- [x] [Review][Patch] `@cems/config` lacks `"type": "module"`; `eslint/index.js` uses CommonJS inside a flat-config file [packages/config/package.json, packages/config/eslint/index.js]
- [x] [Review][Patch] Dockerfile runs as root — add non-root `USER` directive [apps/calc-service/Dockerfile]
- [x] [Review][Patch] Root `package.json` missing `engines.node` — allows version drift across contributors [package.json]
- [x] [Review][Patch] `VITE_API_BASE_URL` has no `ImportMetaEnv` augmentation — loose typing [apps/*/src/vite-env.d.ts]
- [x] [Review][Patch] `main.tsx` imports `React` but never uses binding under react-jsx runtime [apps/*/src/main.tsx:1]
- [x] [Review][Patch] Button declares `asChild?: boolean` but never implements Slot pattern — false public API [packages/ui/src/components/Button.tsx:36]
- [x] [Review][Patch] `RlsContext.role: string` should be `UserRole` enum from `@cems/types` [packages/db/src/middleware/rls.ts:4]
- [x] [Review][Patch] `.env.example` `DATABASE_URL` has empty `password=` + `trustServerCertificate=true` — encourages insecure local habits [.env.example:2]
- [x] [Review][Patch] `Button.tsx` imports `'../lib/utils'` without `.js` extension — breaks Node ESM consumers [packages/ui/src/components/Button.tsx:3]
- [x] [Review][Patch] Python pytest has no `pythonpath` config; `test_health.py` breaks from any non-calc-service CWD [apps/calc-service/pyproject.toml]
- [x] [Review][Patch] `packages/config/package.json` has no `scripts` block — turbo silently skips type-check/lint [packages/config/package.json]
- [x] [Review][Patch] Root `.gitignore` missing bare `*.local` (Task 1 subtask explicitly listed it) [.gitignore]
- [x] [Review][Patch] `vite-env.d.ts` files not listed in story File List [story file]

**Deferred (pre-existing or future story scope):**

- [x] [Review][Defer] Fastify binds 0.0.0.0, no auth/CORS/body limit [apps/api/src/app.ts] — deferred, Story 0.4 scope (API foundation + middleware)
- [x] [Review][Defer] FastAPI no CORS/trusted-host/body-size middleware [apps/calc-service/app/main.py] — deferred, Story 0.5 scope (calc service hardening)
- [x] [Review][Defer] `schema.prisma` empty with `db:generate` wired [packages/db/prisma/schema.prisma] — deferred, Story 0.3 populates schema
- [x] [Review][Defer] Packages export `./src/*.ts` with no build step [packages/*/package.json] — deferred, intentional for MVP (apps consume via path aliases)
- [x] [Review][Defer] Three identical copies of api-client/queryClient/index.css across apps [apps/*/src/lib] — deferred, extract to shared `@cems/http` package post first feature story
- [x] [Review][Defer] No root `eslint` config; `pnpm lint` will fail [.eslint.config.js missing] — deferred, lint wiring not required by story ACs
- [x] [Review][Defer] Unused declared deps: puppeteer, resend, jose, bullmq, @azure/storage-blob, @fastify/swagger [apps/api/package.json] — deferred, pinned now to lock versions; used in Stories 0.4+
- [x] [Review][Defer] `turbo.json` lacks `inputs`/`env`/`passThroughEnv` [turbo.json] — deferred, cache optimisation
- [x] [Review][Defer] `type-check` depends on `^build` but packages have `noEmit: true` [turbo.json] — deferred, cache waste not a correctness bug
- [x] [Review][Defer] `test` pipeline depends on `build` but TS packages have no tests [turbo.json] — deferred, refactor once first tests land
- [x] [Review][Defer] `queryClient.retry: 2` retries on 401/403 [apps/*/src/lib/queryClient.ts] — deferred, refine when auth lands in Story 1.1
- [x] [Review][Defer] `generalSectionSchema.auditDate` unvalidated string [packages/types/src/forms/general.schema.ts] — deferred, form schemas are stubs; tightened in Epics 2–5
- [x] [Review][Defer] `PHOTO_ACCEPTED_TYPES` omits `image/heif`, `image/webp` [packages/types/src/index.ts] — deferred, Story 4.1 reconciles with UX spec
- [x] [Review][Defer] `AuditSection.data: Record<string, unknown>` loses type safety [packages/types/src/audit.ts] — deferred, refinement once section shapes finalise
- [x] [Review][Defer] `apps/api/src/app.ts` doesn't register Swagger/CORS/validators despite declared deps [apps/api/src/app.ts] — deferred, Story 0.4 wires all middleware
- [x] [Review][Defer] `requirements.txt` no hash pinning, no ruff/mypy [apps/calc-service] — deferred, Python tooling in Story 0.5
- [x] [Review][Defer] `typescript` devDep duplicated in every package [packages/*/package.json] — deferred, hoist-to-root refactor

**Dismissed (10):** Prisma 7.5.0 / Puppeteer 24.35.0 "don't exist" (install verifiably succeeded; lockfile populated); local `dist/` artefacts (no git repo, `.gitignore` covers them); `document.getElementById('root')!` (idiomatic Vite bootstrap); demo App.tsx text (intentional AC smoke test); unused future env vars (intentional prep); Vite/vitest port clash; tailwind glob case-sensitivity (discipline); `clean` script blast radius (negligible); admin/client-portal smoke-import variance (AC 3 verified in audit-app); "7 vs 8 audit states" prose typo (implementation is canonical).
