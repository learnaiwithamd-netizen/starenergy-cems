# Story 0.3: Database Schema & RLS Foundation

Status: ready-for-dev

## Story

As a developer,
I want the complete Prisma schema initialized with all entities and RLS middleware enforcing tenant and role isolation on every query,
So that all application features have a secure, tenant-scoped data layer from day one with an immutable audit trail.

## Acceptance Criteria

1. **Given** Prisma schema is initialized in `packages/db`, **When** `pnpm --filter @cems/db db:migrate:dev` runs against an Azure SQL target (or local dockerised SQL Server), **Then** all core tables are created: `audits`, `audit_sections`, `users`, `user_sessions`, `compressor_refs`, `store_refs`, `section_locks`, `audit_log` — with a non-null `tenant_id` column on every tenant-scoped entity.

2. **Given** a request arrives with a valid JWT (simulated in tests), **When** any Prisma query executes via the `@cems/db` client, **Then** the RLS middleware runs `EXEC sp_set_session_context 'tenant_id', @tenantId` (and `user_id`, `user_role`) before the query — verified by a test that asserts the raw SQL.

3. **Given** Azure SQL RLS policies are applied to the `audits` table, **When** a client-role user queries `audits`, **Then** only rows where `client_id` matches their assigned store ids (via `SESSION_CONTEXT('assigned_store_ids')`) are returned — no application-layer filter required. Verified by an integration test using two distinct tenant sessions against a live SQL instance.

4. **Given** `audit_log.repo.ts` is created in `apps/api/src/repositories/`, **When** `appendLog()` is called with a state-transition event, **Then** a row is inserted into `audit_log`; the repository module exports **only** `appendLog()` — no `update()`, `delete()`, or `upsert()` methods exist.

5. **Given** `form_version` and `compressor_db_version` columns exist on the `audits` table, **When** an audit row is created via Prisma, **Then** both fields accept string values, are non-nullable, and reject insert attempts that omit either field.

6. **Given** `packages/db` exposes `prisma` and `withRlsContext()` helpers, **When** `pnpm turbo run type-check --filter=@cems/db --filter=api` runs, **Then** both packages compile with zero errors and `apps/api/src/app.ts` can import and use `prisma` without breaking the build.

## Tasks / Subtasks

- [ ] **Task 1: Update `@cems/db` package dependencies and scripts** (AC: 1, 6)
  - [ ] Verify `packages/db/package.json` has `@prisma/client@7.5.0`, `@prisma/adapter-mssql@7.5.0`, `prisma@7.5.0`, `@cems/types` (workspace)
  - [ ] Add `zod` as dev dep for RLS context validation
  - [ ] Confirm `scripts`: `db:generate`, `db:migrate`, `db:migrate:dev`, `db:studio`, `type-check`
  - [ ] Add `build` script: `prisma generate` (so Prisma client is materialised before downstream type-check via `turbo.json` `^build` dependency)

- [ ] **Task 2: Write the complete Prisma schema** (AC: 1, 5)
  - [ ] Author `packages/db/prisma/schema.prisma` with datasource (sqlserver), generator (prisma-client-js with `previewFeatures: ["driverAdapters"]`)
  - [ ] Enums: `UserRole` (ADMIN, AUDITOR, CLIENT), `AuditStatus` (matches `@cems/types` — 8 values including DRAFT, SUBMITTED, IN_REVIEW, CALC_IN_PROGRESS, CALC_COMPLETE, MANUAL_REVIEW_REQUIRED, APPROVED, PUBLISHED)
  - [ ] Core tables with `@@map` to snake_case + `@@schema("dbo")`:
    - `users` — id, tenant_id, email (unique per tenant), name, role (enum), assigned_store_ids (JSON/NVARCHAR(MAX)), password_hash, created_at, updated_at
    - `user_sessions` — id, user_id, refresh_token_hash (unique), expires_at, created_at, revoked_at (nullable)
    - `store_refs` — id, tenant_id, store_number, store_name, address, banner, region, postal_code, created_at, updated_at
    - `compressor_refs` — id, compressor_db_version (FK-like string), model_number, manufacturer, refrigerant_type, regression_coefficients (JSON), created_at
    - `audits` — id, tenant_id, client_id, store_id (FK store_refs), status (enum), form_version (NOT NULL), compressor_db_version (NOT NULL), current_section_id, auditor_user_id, submitted_at, approved_at, published_at, created_at, updated_at, plus JSON columns: general_data, hvac_data, lighting_data, building_envelope_data
    - `audit_sections` — id, audit_id (FK audits), section_id (string identifier), data (JSON), completed_at, completed_by_user_id, created_at, updated_at
    - `section_locks` — id, audit_id, section_id, user_id, acquired_at, expires_at, heartbeat_at (constraint: unique (audit_id, section_id))
    - `audit_log` — id, tenant_id, audit_id, event_type (string), payload (JSON), actor_user_id, actor_role, occurred_at — INSERT ONLY
  - [ ] Equipment hierarchy tables (architecture mandate — hybrid relational model):
    - `machine_rooms` — id, audit_id, room_number, data (JSON for flexible fields), created_at
    - `racks` — id, machine_room_id, rack_number, data (JSON), created_at
    - `compressors` — id, rack_id, compressor_number, compressor_ref_id (FK compressor_refs), data (JSON), created_at
    - `conventional_units` — id, machine_room_id, unit_number, data (JSON), created_at
    - `condensers` — id, machine_room_id, condenser_number, data (JSON), created_at
    - `walk_ins` — id, audit_id, walk_in_number, data (JSON), created_at
    - `display_cases` — id, rack_id, display_case_number, data (JSON), created_at
    - `controllers` — id, audit_id, controller_number, data (JSON), created_at
  - [ ] All `id` columns are `String @id @default(cuid())` (cuid2 preferred but Prisma default is cuid v1)
  - [ ] All timestamps: `DateTime @default(now())` for created_at; updated_at via `@updatedAt`
  - [ ] All `tenant_id` columns: non-nullable, indexed (`@@index([tenant_id])`)
  - [ ] All FK columns follow `{table_singular}_id` convention, with `@relation` and `onDelete: Restrict` (no accidental cascade deletes)

- [ ] **Task 3: Initial migration** (AC: 1)
  - [ ] Configure `packages/db/prisma/schema.prisma` with Azure SQL + local docker dev: datasource url pulled from `DATABASE_URL` env
  - [ ] Add `docker-compose.yaml` at repo root for local SQL Server 2022 development (simplifies dev onboarding)
  - [ ] Run `pnpm --filter @cems/db db:migrate:dev --name init` — produces `prisma/migrations/<timestamp>_init/migration.sql`
  - [ ] Review generated SQL: verify `tenant_id` columns are non-null, indexes are present, FK constraints use `Restrict` on delete
  - [ ] Commit migration file to git (migrations are source of truth)

- [ ] **Task 4: RLS setup as a separate migration** (AC: 3)
  - [ ] Generate empty migration: `pnpm --filter @cems/db prisma migrate dev --create-only --name add_rls`
  - [ ] Populate the generated `migration.sql` with Azure SQL RLS setup:
    - Enable RLS: `ALTER TABLE dbo.audits ENABLE ROW_LEVEL_SECURITY`
    - Create predicate function: `fn_tenant_predicate(@tenant_id)` returns 1 when `@tenant_id = CAST(SESSION_CONTEXT(N'tenant_id') AS NVARCHAR(50))`
    - Apply predicate as FILTER + BLOCK security policy on every tenant-scoped table: audits, audit_sections, users, user_sessions, store_refs, section_locks, audit_log, machine_rooms, racks, compressors, conventional_units, condensers, walk_ins, display_cases, controllers
    - Create client-role predicate: if `SESSION_CONTEXT('user_role') = 'CLIENT'` then `client_id` must match the caller — applied as additional FILTER predicate on audits table
    - compressor_refs is NOT tenant-scoped (global reference data) — RLS NOT applied to it
  - [ ] Document RLS design in `packages/db/prisma/migrations/README.md`: what tables have RLS, how the predicate functions are structured, how to add RLS to future tables
  - [ ] Run `pnpm --filter @cems/db db:migrate:dev` to apply

- [ ] **Task 5: Replace `packages/db/src/middleware/rls.ts` stub with real implementation** (AC: 2)
  - [ ] Remove the throw-on-call stub from Story 0.1
  - [ ] Implement `withRlsContext(prisma, context)` using Prisma client extensions (`$extends`). Each query runs `sp_set_session_context` via `$executeRaw` with three keys: `tenant_id`, `user_id`, `user_role`, plus `assigned_store_ids` (JSON string) when role is CLIENT
  - [ ] `RlsContext` type (already added in Story 0.2 patch): `{ tenantId: string; userId: string; role: UserRole; assignedStoreIds?: string[] }`
  - [ ] Zod-validate the context at the boundary (reject empty strings, non-GUID userIds, unknown roles)
  - [ ] Export from `packages/db/src/index.ts`: `{ prisma, withRlsContext, RlsContext }`
  - [ ] Write unit test `packages/db/src/middleware/rls.test.ts` that mocks Prisma and asserts the exact `sp_set_session_context` calls happen in order for a representative query

- [ ] **Task 6: `audit_log` repository in apps/api** (AC: 4)
  - [ ] Create `apps/api/src/repositories/audit-log.repo.ts`
  - [ ] Export ONE function: `appendLog({ tenantId, auditId, eventType, payload, actorUserId, actorRole })`. Internally calls `prisma.auditLog.create(...)`
  - [ ] Do NOT export `update`, `delete`, `upsert`, `createMany` — enforced via ESLint rule in file header comment + test
  - [ ] Unit test `apps/api/src/repositories/audit-log.repo.test.ts` verifies: (a) create is called with correct args, (b) module exports only `appendLog`

- [ ] **Task 7: Smoke test `apps/api/src/app.ts` uses `prisma` import** (AC: 6)
  - [ ] Update `apps/api/src/app.ts` to import `prisma` from `@cems/db` (not yet used in any route, just proves the import graph)
  - [ ] Add `GET /api/v1/db-health` route that runs `SELECT 1` via `prisma.$queryRaw\`SELECT 1 AS ok\`` and returns 200 — optional advisory check Abhishek can hit once deployed
  - [ ] This route SKIPS RLS middleware (pre-auth) and documents that fact with a comment

- [ ] **Task 8: `DATABASE_URL` env handling + local dev** (AC: 1)
  - [ ] Update `.env.example` at repo root: `DATABASE_URL` points at local docker SQL Server by default: `sqlserver://localhost:1433;database=cems_dev;user=sa;password=Your_strong_pw_123;trustServerCertificate=true`
  - [ ] `docker-compose.yaml` at repo root — one service `sql` running `mcr.microsoft.com/mssql/server:2022-latest` on port 1433 with `SA_PASSWORD=Your_strong_pw_123` and `ACCEPT_EULA=Y`
  - [ ] Bootstrap script `packages/db/scripts/init-dev-db.sh` — creates the `cems_dev` database in the running container (SQL Server doesn't auto-create the DATABASE parameter from the connection string)
  - [ ] Document in `packages/db/README.md`: (a) `docker compose up -d sql`, (b) `./packages/db/scripts/init-dev-db.sh`, (c) `pnpm --filter @cems/db db:migrate:dev`

- [ ] **Task 9: Integration test — RLS actually filters** (AC: 3)
  - [ ] Create `packages/db/tests/rls.integration.test.ts` (ONLY runs when `RUN_INTEGRATION=1` env var is set — guarded because it needs a live SQL Server)
  - [ ] Seed two tenants, two audits per tenant, one user per tenant
  - [ ] With `withRlsContext(prisma, tenantAContext)` query all audits — assert only tenant A's 2 audits returned
  - [ ] With `withRlsContext(prisma, tenantBContext)` query all audits — assert only tenant B's 2 audits
  - [ ] With `withRlsContext(prisma, clientContextForStoreX)` query — assert only audits with `store_id = X` returned
  - [ ] Document in test header that this runs against `docker compose` SQL Server (will also pass against Azure SQL post-deploy)

- [ ] **Task 10: Update KV `database-url` secret content** (verification only, not code)
  - [ ] Story 0.2 main.bicep already writes `database-url` secret to KV. Document in `packages/db/README.md` that for any non-local environment, the Bicep-generated connection string is correct
  - [ ] Note: local dev uses `.env` (not KV); dev/staging/prod use KV references — no action needed in this story, just documentation confirmation

- [ ] **Task 11: Verify and test** (AC: 1–6)
  - [ ] `pnpm --filter @cems/db db:generate` — Prisma client generates without error
  - [ ] `pnpm --filter @cems/db db:migrate:dev` against local docker SQL — produces expected tables (verify via `prisma studio`)
  - [ ] `pnpm turbo run type-check` — 9 packages pass
  - [ ] `pnpm turbo run test` — unit tests pass (rls middleware unit test, audit-log repo test)
  - [ ] `RUN_INTEGRATION=1 pnpm --filter @cems/db test` (optional, if SQL Server is running locally) — RLS integration test passes
  - [ ] `pnpm turbo run build` — full workspace build clean

## Dev Notes

### Tooling decision: Prisma + RLS via SESSION_CONTEXT

Architecture mandate is clear: every query goes through Prisma, RLS enforces tenant isolation at the database layer via `SESSION_CONTEXT`. We implement this with **Prisma Client Extensions (`$extends`)**, not the deprecated `$use` middleware.

```typescript
// packages/db/src/middleware/rls.ts
import { PrismaClient } from '@prisma/client'
import { z } from 'zod'
import { UserRole } from '@cems/types'

const rlsContextSchema = z.object({
  tenantId: z.string().min(1),
  userId: z.string().min(1),
  role: z.nativeEnum(UserRole),
  assignedStoreIds: z.array(z.string()).optional(),
})

export type RlsContext = z.infer<typeof rlsContextSchema>

export function withRlsContext(prisma: PrismaClient, context: RlsContext) {
  const validated = rlsContextSchema.parse(context)
  return prisma.$extends({
    query: {
      $allModels: {
        async $allOperations({ args, query }) {
          await prisma.$executeRaw`EXEC sp_set_session_context @key = N'tenant_id', @value = ${validated.tenantId}, @read_only = 0`
          await prisma.$executeRaw`EXEC sp_set_session_context @key = N'user_id', @value = ${validated.userId}, @read_only = 0`
          await prisma.$executeRaw`EXEC sp_set_session_context @key = N'user_role', @value = ${validated.role}, @read_only = 0`
          if (validated.assignedStoreIds) {
            await prisma.$executeRaw`EXEC sp_set_session_context @key = N'assigned_store_ids', @value = ${JSON.stringify(validated.assignedStoreIds)}, @read_only = 0`
          }
          return query(args)
        },
      },
    },
  })
}
```

**Key behaviours:**
- Context set BEFORE every query (not once per request) — because Prisma's connection pool may return a different connection between queries, and SESSION_CONTEXT is per-connection
- `@read_only = 0` means the context can be reset within the session; `@read_only = 1` would prevent reuse
- Zod validation at the boundary — reject empty strings or malformed roles early

### RLS SQL — exact patterns

Every tenant-scoped table gets a FILTER + BLOCK predicate. Example for `audits`:

```sql
-- In migration add_rls/migration.sql
CREATE SCHEMA security;
GO

CREATE FUNCTION security.fn_tenant_predicate(@tenant_id NVARCHAR(50))
  RETURNS TABLE
  WITH SCHEMABINDING
AS
  RETURN SELECT 1 AS fn_result
  WHERE @tenant_id = CAST(SESSION_CONTEXT(N'tenant_id') AS NVARCHAR(50))
     OR CAST(SESSION_CONTEXT(N'user_role') AS NVARCHAR(20)) = 'ADMIN';
GO

-- Additional client-role predicate for audits (filters by assigned store ids)
CREATE FUNCTION security.fn_audits_client_predicate(@store_id NVARCHAR(50))
  RETURNS TABLE
  WITH SCHEMABINDING
AS
  RETURN SELECT 1 AS fn_result
  WHERE CAST(SESSION_CONTEXT(N'user_role') AS NVARCHAR(20)) != 'CLIENT'
     OR EXISTS (
       SELECT 1
       FROM OPENJSON(CAST(SESSION_CONTEXT(N'assigned_store_ids') AS NVARCHAR(MAX)))
       WHERE value = @store_id
     );
GO

CREATE SECURITY POLICY security.audits_policy
  ADD FILTER PREDICATE security.fn_tenant_predicate(tenant_id) ON dbo.audits,
  ADD BLOCK PREDICATE security.fn_tenant_predicate(tenant_id) ON dbo.audits AFTER INSERT,
  ADD BLOCK PREDICATE security.fn_tenant_predicate(tenant_id) ON dbo.audits BEFORE UPDATE,
  ADD FILTER PREDICATE security.fn_audits_client_predicate(store_id) ON dbo.audits
  WITH (STATE = ON);
GO
```

Repeat the tenant predicate policy for: `audit_sections`, `users`, `user_sessions`, `store_refs`, `section_locks`, `audit_log`, `machine_rooms`, `racks`, `compressors`, `conventional_units`, `condensers`, `walk_ins`, `display_cases`, `controllers` (adjust the per-table column name if it's not `tenant_id` directly — most join through audit or store).

**`compressor_refs` is NOT RLS-protected** — it's global reference data.

### Naming conventions (mandate from Architecture § Naming Patterns)

| Layer | Rule | Example |
|---|---|---|
| Prisma model name | PascalCase singular | `model Audit` |
| DB table name | `@@map('snake_case_plural')` | `@@map('audits')` |
| Prisma field | camelCase | `storeNumber String` |
| DB column | `@map('snake_case')` | `@map('store_number')` |
| FK field | `{tableSingular}Id` + `@map('{table_singular}_id')` | `auditId String @map('audit_id')` |
| Enum value | SCREAMING_SNAKE_CASE | `DRAFT` |

Repositories are the translation boundary — route handlers and services see camelCase only. Never emit snake_case in JSON API responses.

### Hybrid data model (Architecture § Data Architecture)

- JSON columns on `audits` for flat-field sections: `general_data`, `hvac_data`, `lighting_data`, `building_envelope_data` — schema-less on the DB side, typed via `packages/types/src/forms/*.schema.ts`
- Relational tables for equipment hierarchy: `machine_rooms → racks → compressors`, plus `walk_ins`, `display_cases`, `condensers`, `controllers`, `conventional_units`
- Form + compressor DB version stamped on every audit row (NOT NULL)

### Local dev dependency — SQL Server 2022 via docker

Architecture requires Azure SQL, but for local development a dockerised SQL Server instance is acceptable and recommended:

```yaml
# docker-compose.yaml at repo root
services:
  sql:
    image: mcr.microsoft.com/mssql/server:2022-latest
    container_name: cems-sql
    platform: linux/amd64  # works on Apple Silicon via Rosetta
    environment:
      ACCEPT_EULA: "Y"
      SA_PASSWORD: "Your_strong_pw_123"
      MSSQL_PID: "Developer"
    ports:
      - "1433:1433"
    volumes:
      - cems-sql-data:/var/opt/mssql
volumes:
  cems-sql-data:
```

Developers run `docker compose up -d sql`, then `packages/db/scripts/init-dev-db.sh` creates the `cems_dev` database. Prisma targets `sqlserver://localhost:1433;database=cems_dev;...` via `.env`.

### Repository layer — where it lives

Repositories are in `apps/api/src/repositories/`, NOT in `packages/db`. `@cems/db` owns the Prisma client + RLS middleware; it doesn't know about business entities. Route handlers in `apps/api/src/routes/*` never call Prisma directly — always through a repo function. This is an architectural mandate (Story 0.1 Dev Notes § Anti-Patterns).

`audit-log.repo.ts` is the only repo this story creates; others land in their respective feature stories.

### Audit log immutability

The story mandates `audit_log` is append-only:
- Table has no `updated_at` column
- Repository exports ONLY `appendLog` — no `update`, `delete`, `upsert`, `createMany`
- DB-level enforcement optional: a trigger can `RAISERROR` on UPDATE/DELETE attempts (defer to later hardening story if needed)
- For now the API-layer enforcement (single-function repo) is enough

### Previous story learnings to apply

From Story 0.2 review findings carried forward:
- **Pin exact API versions** — no wildcards in `@prisma/client` or related packages (already done at Story 0.1)
- **`type: module` on packages** — `@cems/db` already has this
- **Validate inputs at system boundaries** — Zod-validate `RlsContext` before setting SESSION_CONTEXT
- **No plaintext credentials** — `DATABASE_URL` comes from env/.env; local dev password is documented but should be rotated for any shared env
- **Non-null tenant_id** — mandate from architecture; enforce via Prisma schema `String @db.NVarChar(50)` (not `String?`)
- **Cache invalidation** — Prisma client is a singleton; when `DATABASE_URL` rotates, the app needs a restart (same pattern as `azure-blob.ts` cached client). Document this expectation in `packages/db/README.md`

### Deferred to later stories (do NOT include)

- **calculations / llm_flags / override_records tables** — Story 8.x (Calculation Engine)
- **reports / published_reports tables** — Story 9.x (Report Generation)
- **notifications / email_outbox tables** — Story 5.5
- **Seeding compressor_refs with real regression data** — Story 6.2 (Compressor Regression Database Management)
- **Seeding store_refs** — Story 6.1
- **DB-level triggers preventing audit_log UPDATE/DELETE** — hardening story
- **Stored procedures for state machine transitions** — Story 7.3 (State Machine)
- **Backup / point-in-time restore automation** — Azure SQL has this out of box; no IaC needed for MVP
- **Performance indexes beyond `tenant_id`** — will be added per-feature as queries reveal hot paths

### Estimated effort

Sizable. Full schema for 16 tables + RLS SQL migration + middleware + integration tests + docker-compose tooling. Expect this to be the largest Epic 0 story by LOC.

### Architecture references

- Hybrid data model — [Source: architecture.md § Category 1: Data Architecture]
- RLS via SESSION_CONTEXT — [Source: architecture.md § Category 2: Authentication & Security]
- Naming patterns — [Source: architecture.md § Naming Patterns]
- audit_log append-only — [Source: architecture.md § Gap Analysis Results — Gap 2]
- form/compressor DB version stamping — [Source: architecture.md § Data Architecture]
- Tenant isolation Day 1 — [Source: architecture.md § NFR-SC3]

### References

- Epics: Story 0.3 acceptance criteria — [Source: epics.md § Story 0.3]
- Story 0.1 `@cems/db` package scaffold — [Source: implementation-artifacts/0-1-turborepo-monorepo-and-shared-package-scaffold.md]
- Story 0.2 Azure SQL provisioned with KV-referenced `database-url` — [Source: implementation-artifacts/0-2-azure-infrastructure-provisioning.md § Dev Notes]

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List
