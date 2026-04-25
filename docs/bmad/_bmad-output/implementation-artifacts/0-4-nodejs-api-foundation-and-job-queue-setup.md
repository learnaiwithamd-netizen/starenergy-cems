# Story 0.4: Node.js API Foundation & Job Queue Setup

Status: ready-for-dev

## Story

As a developer,
I want a running Fastify API with JWT auth middleware, RFC 7807 error handling, OpenAPI docs, structured logging, and BullMQ queues configured,
So that all feature routes have a consistent, observable, and testable foundation.

## Acceptance Criteria

1. **Given** the API server starts, **When** `GET /api/v1/health` is called, **Then** `200 OK` is returned with `{ "status": "ok" }`. Existing `/api/v1/db-health` from Story 0.3 continues to work; both routes are unauthenticated by design.

2. **Given** a route is called without a valid JWT, **When** the auth middleware runs, **Then** the response is `401` with body matching RFC 7807: `{ "type": "https://cems.starenergy.ca/errors/authentication-required", "title": "Unauthorized", "status": 401, "detail": "..." , "instance": "/api/v1/..." }`. Public routes (`/api/v1/health`, `/api/v1/db-health`, `/api/v1/docs`, `/api/v1/auth/login`) skip the auth check.

3. **Given** any unhandled error is thrown in a route handler or service, **When** the global error handler processes it, **Then** the response is JSON in RFC 7807 shape (`type`, `title`, `status`, `detail`, `instance`, optional `errors[]`). Stack traces are NEVER returned in the body — they go to Pino with `request_id` correlation.

4. **Given** `@fastify/swagger` and `@fastify/swagger-ui` are registered, **When** `GET /api/v1/docs` is accessed (browser or curl), **Then** an OpenAPI 3.0 spec lists every registered route with its Zod-derived JSON Schema for params, body, and responses.

5. **Given** a request completes, **When** Pino logs the request, **Then** the log line is single-line JSON containing at minimum: `tenant_id`, `user_id`, `route`, `method`, `status_code`, `duration_ms`, `request_id`. `tenant_id` and `user_id` are `null` for unauthenticated requests.

6. **Given** BullMQ is configured with Redis (local docker for dev, Azure Cache for Redis in deployed envs), **When** a test enqueues a job on `cems:email-notification:low`, **Then** the job persists in Redis, a test worker dequeues it, and the worker's processor function executes with the job payload.

7. **Given** an authenticated request arrives with a valid JWT, **When** the request enters a route handler, **Then** the handler receives an RLS-wrapped Prisma client (via `withRlsTransaction(ctx, fn)` introduced in this story) where every query inside `fn` runs on a single pinned connection with `SESSION_CONTEXT` already set — closing the three deferred HIGH items from Story 0.3 review (raw-query bypass, pool-interleaving, `$transaction` middleware skip).

8. **Given** all of the above are wired, **When** `pnpm turbo run type-check` runs, **Then** all packages still pass; **When** `pnpm turbo run test --filter=api` runs, **Then** every new piece (auth middleware, error handler, RLS transaction helper, BullMQ enqueue/dequeue) has at least one test that passes.

## Tasks / Subtasks

- [ ] **Task 1: Project structure + dependency check** (AC: 1, 8)
  - [ ] Confirm `apps/api/package.json` already includes: `fastify@5.8.5`, `@fastify/swagger@^9.4.0`, `@fastify/swagger-ui@^5.2.1`, `bullmq@5.74.1`, `jose@^5.9.6`, `pino@^9.5.0`, `@cems/db`, `@cems/types`, `zod`, `zod-to-json-schema`. Add anything missing.
  - [ ] Add `@fastify/sensible@^6.0.3` for `httpErrors.*` factory + RFC 7807 conformant error utilities.
  - [ ] Add `pino-http@^10.3.0` for request logger middleware (or roll our own — see Task 5).
  - [ ] Add `ioredis@^5.4.1` (BullMQ peer dep) and `@redis/client@^4.7.0` for direct Redis access where needed.
  - [ ] Add `pino-pretty@^11.3.0` as `devDependency` for human-readable dev logs.
  - [ ] Confirm `apps/api/tsconfig.json` paths still resolve `@cems/db` and `@cems/types`.

- [ ] **Task 2: Pino structured logger** (AC: 5)
  - [ ] Create `apps/api/src/lib/logger.ts` exporting a singleton `logger` (pino instance) with: ISO timestamp, redact `req.headers.authorization` and `req.headers.cookie`, base fields `service: 'cems-api'`, `env: process.env.NODE_ENV ?? 'development'`.
  - [ ] In dev (`NODE_ENV !== 'production'`), pipe through `pino-pretty` for readable output. In prod, raw JSON.
  - [ ] Configure Fastify's logger via the `logger.ts` instance (`Fastify({ logger })`). Each request gets a child logger with `request_id` (UUID v4) auto-added.

- [ ] **Task 3: RLS transaction helper — close Story 0.3 deferred items** (AC: 7)
  - [ ] Add `withRlsTransaction(prisma, ctx, fn)` to `packages/db/src/middleware/rls.ts`. Implementation:
    ```typescript
    export async function withRlsTransaction<T>(
      prisma: PrismaClient,
      context: RlsContext,
      fn: (tx: Prisma.TransactionClient) => Promise<T>,
    ): Promise<T> {
      const validated = rlsContextSchema.parse(context)
      return prisma.$transaction(async (tx) => {
        await tx.$executeRaw`EXEC sp_set_session_context ...`  // 4 keys, on the SAME connection (tx)
        return fn(tx)
      }, { isolationLevel: 'ReadCommitted', timeout: 10_000 })
    }
    ```
  - [ ] All four `sp_set_session_context` calls + the user's `fn` body run on the **same pinned connection** (Prisma's interactive transaction guarantees connection affinity), eliminating pool interleaving.
  - [ ] Raw queries via `tx.$queryRaw` / `tx.$executeRaw` are now safe because they share the same SESSION_CONTEXT.
  - [ ] Update JSDoc on the older `withRlsContext` to mark it deprecated for new code: prefer `withRlsTransaction` for any tenant-scoped operation. `withRlsContext` remains for non-transactional reads where the trade-off is documented.
  - [ ] Add a unit test asserting the transaction callback receives the tx client and runs ONE `$transaction` call with 5 statements (4 EXECs + the user fn).
  - [ ] Add an integration test (gated by `RUN_INTEGRATION=1`) showing `withRlsTransaction(prisma, tenantA-ctx, async tx => tx.audit.findMany())` returns only tenant A's audits AND `tx.$queryRaw` raw queries are also tenant-filtered.

- [ ] **Task 4: JWT auth middleware** (AC: 2)
  - [ ] Create `apps/api/src/middleware/auth.ts`:
    - Use `jose` to verify HS256 JWTs signed with `process.env.JWT_SECRET` (loaded from Key Vault in deployed envs; Story 0.3 already seeds the secret name).
    - Token claims: `sub` (userId), `tenantId`, `role` (UserRole), `assignedStoreIds` (string[]), `iat`, `exp`. Validate with Zod.
    - On success, attach `request.rlsContext: RlsContext` (Fastify decorator).
    - On failure, throw `httpErrors.unauthorized(detail)` which the global error handler translates to RFC 7807.
  - [ ] Public route allowlist: `/api/v1/health`, `/api/v1/db-health`, `/api/v1/docs`, `/api/v1/docs/*`, `/api/v1/auth/login`, `/api/v1/auth/refresh`. Implemented as a `preHandler` that checks `request.routeOptions.url` against the list.
  - [ ] Three tests: (a) missing `Authorization` header → 401 RFC 7807; (b) malformed token → 401; (c) valid token → request reaches handler with `rlsContext` populated.

- [ ] **Task 5: Request logging + tenant/user context propagation** (AC: 5)
  - [ ] Use Fastify's built-in request lifecycle hooks (no extra plugin needed):
    - `onRequest` — generate `request.id` (UUID v4), start timer.
    - `onResponse` — log: `request_id`, `route`, `method`, `status_code`, `duration_ms`, `tenant_id` (from `request.rlsContext?.tenantId ?? null`), `user_id`, `user_role`.
  - [ ] Errors get logged at `error` level with stack; success at `info`.
  - [ ] Test: assert that a request with no auth produces a log line with `tenant_id: null`, and a request with valid JWT produces a log line with the correct `tenant_id`.

- [ ] **Task 6: Global error handler + RFC 7807** (AC: 3)
  - [ ] Create `apps/api/src/middleware/error-handler.ts`:
    - Map `FastifyError` codes + `httpErrors.*` to RFC 7807 shape: `{ type, title, status, detail, instance, errors? }`.
    - `type` URI scheme: `https://cems.starenergy.ca/errors/{kebab-case-slug}` (e.g., `validation-error`, `authentication-required`, `not-found`, `internal-error`).
    - Validation errors (Zod) → 422, include `errors: [{ field, message }]`.
    - Unknown errors → 500 with generic `detail: "Internal server error"` (no stack in body); full error logged with `request_id` for correlation.
    - Set `Content-Type: application/problem+json` per RFC 7807.
  - [ ] Define a `ProblemDetail` Zod schema in `packages/types/src/api.ts` (already exists as TS interface — add Zod schema parallel; export from `@cems/types`).
  - [ ] Three tests: (a) `httpErrors.notFound()` → 404 RFC 7807 with correct `type`; (b) Zod validation failure on a fixture route → 422 with `errors[]`; (c) unhandled `throw new Error('boom')` → 500 with no stack in body, error logged.

- [ ] **Task 7: OpenAPI docs via @fastify/swagger** (AC: 4)
  - [ ] In `apps/api/src/app.ts`, register `@fastify/swagger` with OpenAPI 3.0 spec metadata: `info.title = 'CEMS API'`, `info.version = '0.0.1'`, `servers: [{ url: '/api/v1' }]`, security schemes (`bearerAuth`).
  - [ ] Register `@fastify/swagger-ui` mounted at `/api/v1/docs`.
  - [ ] Use `zod-to-json-schema` to convert Zod schemas to JSON Schema for route registrations. Add a small helper `zodToFastifySchema(zodSchema)` in `apps/api/src/lib/schema.ts`.
  - [ ] Register at least 2 routes that use Zod schemas so `/api/v1/docs` shows real spec content (a fixture route that accepts a body + the existing health route).
  - [ ] Test: `GET /api/v1/docs/json` returns a valid OpenAPI 3.0 document (assert `openapi: '3.0.x'` and `paths['/health']` exists).

- [ ] **Task 8: BullMQ + Redis setup** (AC: 6)
  - [ ] Add `redis` service to repo-root `docker-compose.yaml`: `redis:7-alpine`, port `127.0.0.1:6379:6379`, healthcheck via `redis-cli ping`, persistent volume.
  - [ ] Update `.env.example` and `packages/db/.env`-pattern: add `REDIS_URL=redis://localhost:6379`.
  - [ ] Create `apps/api/src/lib/redis.ts` — singleton `IORedis` connection from `process.env.REDIS_URL` with `maxRetriesPerRequest: null` (BullMQ requirement).
  - [ ] Create `apps/api/src/jobs/queue.ts` — defines BullMQ `Queue` instances by name: `cems:email-notification:low`, `cems:calculation:normal`, `cems:pdf-generation:normal` (placeholders for Stories 0.5, 8, 9). Use the architecture-mandated naming `cems:{job-type}:{priority}`.
  - [ ] Create `apps/api/src/jobs/email-notification.job.ts` — BullMQ `Worker` skeleton that logs the job and returns `{ success: true }`. Real implementation lands in Story 5.5.
  - [ ] Test: enqueue a job on `cems:email-notification:low` via the queue; assert it reaches Redis (check via `await queue.getJobCounts()`); have a worker process it; assert the processor was called with the payload.

- [ ] **Task 9: Per-request RLS context wiring** (AC: 7)
  - [ ] Create `apps/api/src/middleware/rls-request.ts`: `preHandler` that, for authenticated routes, attaches a per-request `db` client built from `withRlsTransaction(prisma, request.rlsContext, fn)`. Pattern:
    ```typescript
    fastify.decorateRequest('withRls', null)
    fastify.addHook('preHandler', async (req) => {
      if (!req.rlsContext) return
      req.withRls = (fn) => withRlsTransaction(prisma, req.rlsContext!, fn)
    })
    ```
  - [ ] In a route handler: `const audits = await req.withRls(async (tx) => tx.audit.findMany({...}))` — every query in `fn` is RLS-context-pinned to the same connection.
  - [ ] Document this pattern in `apps/api/README.md` (new file): "Tenant-scoped data access MUST go through `req.withRls(fn)`. Direct `prisma.*` calls bypass RLS."
  - [ ] Test: a fixture route that uses `req.withRls` to read audits — verify SESSION_CONTEXT is set on the same tx; verify cross-tenant data is not visible.

- [ ] **Task 10: Wire it all together in `app.ts`** (AC: 1, 2, 3, 4, 5)
  - [ ] Update `apps/api/src/app.ts`:
    1. Build Fastify with the Pino logger
    2. Register `@fastify/sensible` (provides `httpErrors`)
    3. Register `@fastify/swagger` + `@fastify/swagger-ui`
    4. Register the global error handler (`fastify.setErrorHandler`)
    5. Register the auth `preHandler` (skipped for public routes)
    6. Register the RLS-request `preHandler`
    7. Register the request-logging `onRequest` + `onResponse` hooks
    8. Register routes: health, db-health (existing) + a small fixture route demonstrating Zod schema + RLS access (deferred to actual feature stories)
  - [ ] Update `apps/api/src/server.ts` to start workers (BullMQ) alongside the HTTP server. On `SIGTERM`, gracefully drain the queues and close Redis.

- [ ] **Task 11: Update `apps/api/src/repositories/audit-log.repo.ts`** (AC: 7)
  - [ ] The `appendLog(db, input)` signature already accepts a wrapped client (Story 0.3 patch). Add a thin convenience wrapper `appendLogFromRequest(req, input)` that pulls `req.withRls` and runs `appendLog(tx, input)` inside the transaction. Document that route handlers should prefer the `req`-form.

- [ ] **Task 12: Update README + .env handling** (AC: 6)
  - [ ] Create `apps/api/README.md`: how to run locally (docker compose up sql + redis, set env, `pnpm --filter api dev`), the `req.withRls(fn)` pattern, the BullMQ worker model.
  - [ ] Update root `.env.example` with `REDIS_URL`, `JWT_SECRET`, `JWT_REFRESH_SECRET` (Story 0.3 already lists these — confirm + document defaults for local).
  - [ ] Update `docker-compose.yaml` healthcheck section so `redis` is in `cems-redis` container.

- [ ] **Task 13: Verify and test** (AC: 8)
  - [ ] `pnpm turbo run type-check` → 10/10 packages pass
  - [ ] `pnpm turbo run test --filter=!calc-service` → all green; new tests for auth (3), error handler (3), RLS transaction (1 unit + 1 integration), BullMQ (1), request logging (1), Zod-to-OpenAPI (1) — at least 10 new test cases
  - [ ] `pnpm --filter api dev` starts the server; `curl localhost:3001/api/v1/health` returns ok; `curl localhost:3001/api/v1/docs/json` returns OpenAPI 3.0; an unauthenticated request to a non-public route returns RFC 7807 401
  - [ ] Manual: enqueue a test email-notification job; observe the worker processing it in logs

## Dev Notes

### Closes the three deferred HIGH items from Story 0.3 code review

| Story 0.3 Deferred | Resolution in 0.4 |
|---|---|
| RLS raw-query bypass | `withRlsTransaction(prisma, ctx, fn)` runs `fn` inside an interactive `$transaction`. Within `fn`, `tx.$queryRaw` and `tx.$executeRaw` use the same connection where `SESSION_CONTEXT` is set, so RLS predicates apply correctly. Direct `prisma.$queryRaw` outside `fn` is still unsafe — README + JSDoc forbid it for tenant data. |
| Pool-interleaving race | The 4 `sp_set_session_context` EXECs and the user's queries all run on the same pinned tx connection. No pool checkout in between. |
| `$transaction` batch form skips middleware | Inside `withRlsTransaction`, the user's `fn` receives a `tx` (Prisma.TransactionClient) where `SESSION_CONTEXT` is already set on this connection. Nested `tx.audit.findMany()` calls work correctly without re-running the middleware. |

### Fastify version + plugins (architecture mandate)

| Plugin | Version | Purpose |
|---|---|---|
| `fastify` | 5.8.5 | core (already pinned Story 0.1) |
| `@fastify/swagger` | ^9.4.0 | OpenAPI 3.0 spec generation |
| `@fastify/swagger-ui` | ^5.2.1 | `/api/v1/docs` UI |
| `@fastify/sensible` | ^6.0.3 | `httpErrors.*` factories + RFC 7807 helpers |
| `jose` | ^5.9.6 | JWT verify (HS256) — JWT_SECRET from Key Vault in deployed envs |
| `pino` | ^9.5.0 | structured JSON logger |
| `pino-pretty` | ^11.3.0 (dev) | human-readable dev logs |
| `bullmq` | 5.74.1 | job queue (already pinned) |
| `ioredis` | ^5.4.1 | BullMQ peer dep |
| `zod` | ^3.24.1 | request validation (already in deps) |
| `zod-to-json-schema` | ^3.24.1 | Zod → OpenAPI conversion |

### RFC 7807 — exact response shape

All errors return:

```json
{
  "type": "https://cems.starenergy.ca/errors/<slug>",
  "title": "Human-readable summary",
  "status": 422,
  "detail": "Specific message about THIS occurrence",
  "instance": "/api/v1/audits/abc123/sections/general",
  "errors": [{ "field": "grossArea", "message": "Must be positive" }]
}
```

`Content-Type: application/problem+json` (NOT `application/json`).

| Slug | Status | When |
|---|---|---|
| `validation-error` | 422 | Zod schema validation failures |
| `authentication-required` | 401 | Missing or invalid JWT |
| `forbidden` | 403 | Valid JWT but insufficient role/tenant access |
| `not-found` | 404 | Resource doesn't exist |
| `conflict` | 409 | Stale write / concurrent update |
| `payload-too-large` | 413 | Body limit exceeded (default 1 MB) |
| `internal-error` | 500 | Unhandled errors |
| `service-unavailable` | 503 | DB or Redis down (returned by health/readiness probes) |

### JWT claim shape (for tests + future auth story)

```typescript
const jwtClaimsSchema = z.object({
  sub: z.string(),                    // userId
  tenantId: z.string(),
  role: z.nativeEnum(UserRole),
  assignedStoreIds: z.array(z.string()).default([]),
  iat: z.number(),
  exp: z.number(),
})
```

Story 0.4 doesn't ISSUE tokens — that's Story 1.1. Here we only VERIFY them. For tests, sign tokens with `jose.SignJWT` using a known dev secret.

### Pino log line — exact required fields

```json
{
  "level": "info",
  "time": "2026-04-25T01:23:45.678Z",
  "service": "cems-api",
  "env": "development",
  "request_id": "ad7c5b2e-...",
  "tenant_id": "tenant-a",
  "user_id": "user-1",
  "user_role": "AUDITOR",
  "method": "GET",
  "route": "/api/v1/audits/:auditId",
  "status_code": 200,
  "duration_ms": 47,
  "msg": "request completed"
}
```

For unauthenticated requests, `tenant_id`, `user_id`, `user_role` are `null`.

Redaction: `req.headers.authorization`, `req.headers.cookie`, any field matching `*password*` or `*secret*`. Use Pino's built-in `redact` option.

### BullMQ job naming + queue layout

Architecture mandates `cems:{job-type}:{priority}`:

| Queue name | Job purpose | Used by |
|---|---|---|
| `cems:email-notification:low` | Transactional email sends (Resend) | Story 5.5, 9.4 |
| `cems:calculation:normal` | ECM savings + energy baseline calc | Story 8.1, 8.2 |
| `cems:llm-review:normal` | Claude-API LLM anomaly check | Story 8.3 |
| `cems:pdf-generation:normal` | Puppeteer PDF render | Story 9.1, 9.5 |

Story 0.4 creates queue+worker scaffolding for `email-notification` only — others are stubs (queue defined, no worker). Real workers land in their feature stories.

Worker config (each):
- `concurrency: 5` (default; tune later)
- `attempts: 3`, `backoff: { type: 'exponential', delay: 5000 }`
- `removeOnComplete: { age: 3600, count: 1000 }`, `removeOnFail: { age: 86400 }`
- `onFailed` handler: log + write to `audit_log` via `appendLog`

### Redis setup — local docker

Add to `docker-compose.yaml`:

```yaml
  redis:
    image: redis:7-alpine
    container_name: cems-redis
    ports:
      - "127.0.0.1:6379:6379"
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      retries: 5
    volumes:
      - cems-redis-data:/data
```

Production envs use Azure Cache for Redis (provisioned in Story 0.2 Bicep). Connection string comes from Key Vault `redis-url` secret (Story 0.3 already wires the App Service reference).

### Public route allowlist — must NOT change without architecture review

```typescript
const PUBLIC_ROUTES = [
  '/api/v1/health',
  '/api/v1/db-health',
  '/api/v1/docs',
  '/api/v1/docs/static/*',
  '/api/v1/docs/json',
  '/api/v1/docs/yaml',
  '/api/v1/auth/login',     // Story 1.1
  '/api/v1/auth/refresh',   // Story 1.1
]
```

Any new public route requires updating `apps/api/README.md` + this list + a security review note in the next story's Dev Notes.

### Architecture references

- Service / Repository / Route layering — [Source: architecture.md § Architectural Boundaries]
- BullMQ + Redis (Azure Cache) — [Source: architecture.md § Async Job Pipeline]
- Pino → Application Insights — [Source: architecture.md § Observability]
- RFC 7807 — [Source: architecture.md § RFC 7807 Problem Details]
- JWT strategy + role TTLs — [Source: architecture.md § Authentication & Security]
- Public/internal route boundaries — [Source: architecture.md § API Access Control]

### Previous story learnings to apply

From Story 0.3 review findings:
- **Append-only `audit_log`** — DB BLOCK predicates now enforce. Failed jobs that write to audit_log must call `appendLog` (NOT a raw INSERT).
- **`withRlsTransaction` MUST be the only path for tenant-scoped data access** — explicitly forbid raw `prisma.$queryRaw` on tenant tables in README + ESLint rule (defer ESLint rule to Story 0.6 CI/lint hardening).
- **Zod validation at every system boundary** — JWT claims, route params/body, BullMQ job payloads.
- **Lazy Prisma singleton** — already in place from Story 0.3 patches.

From Story 0.2 review findings:
- **`@read_only = 0`** on session context (deferred from 0.3) — `withRlsTransaction` doesn't need read_only because the connection is pinned and won't be reused mid-request anyway.
- **Pino redaction** — apply to Authorization + cookie headers.

### Deferred to later stories (do NOT include)

- **Token issuance + refresh flow** — Story 1.1 (login endpoint, refresh rotation)
- **RBAC permission table / policy engine** — Story 1.2 (route guards beyond auth)
- **Real BullMQ workers** — Stories 5.5 (email), 8.x (calc), 9.x (PDF)
- **OpenAPI client generation for frontends** — Story 0.6 CI/CD (run `openapi-typescript` on the spec)
- **Distributed tracing / Application Insights wiring** — Story 0.6 (the AppInsights resource is provisioned, but `applicationinsights` SDK integration is CI-time work)
- **Rate limiting** — `@fastify/rate-limit` post-MVP
- **CORS** — Story 1.1 (when first frontend talks to api)

### Project structure notes

This story finally populates the `apps/api/src/` structure that Story 0.1 created with `.gitkeep` placeholders:

```
apps/api/src/
├── app.ts                     # Fastify build (rewrite — heavy)
├── server.ts                  # HTTP listen + worker startup
├── routes/                    # (still placeholder; Story 1.1 adds first real route)
├── services/                  # (still placeholder)
├── repositories/
│   ├── audit-log.repo.ts      # already exists; add appendLogFromRequest
│   └── audit-log.repo.test.ts
├── jobs/
│   ├── queue.ts               # BullMQ queue definitions (NEW)
│   └── email-notification.job.ts  # Worker skeleton (NEW)
├── middleware/
│   ├── auth.ts                # JWT verify + decorate request (NEW)
│   ├── rls-request.ts         # withRls hook (NEW)
│   └── error-handler.ts       # RFC 7807 handler (NEW)
└── lib/
    ├── azure-blob.ts          # already exists
    ├── azure-blob.test.ts     # already exists
    ├── logger.ts              # Pino instance (NEW)
    ├── redis.ts               # IORedis singleton (NEW)
    └── schema.ts              # zod-to-fastify helper (NEW)
```

### References

- Epics: Story 0.4 acceptance criteria — [Source: epics.md § Story 0.4]
- Story 0.3 deferred items — [Source: deferred-work.md § Deferred from: code review of 0-3-database-schema-and-rls-foundation]
- @cems/db `withRlsContext` (existing) — [Source: packages/db/src/middleware/rls.ts]

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List
