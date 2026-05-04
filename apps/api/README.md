# CEMS API

Node.js 22 + Fastify 5.8.5 REST API. JWT-authenticated, RFC 7807-compliant, OpenAPI-documented, BullMQ-driven.

## Local development

```bash
# 1. Start dependencies (SQL Server + Redis)
CEMS_SQL_SA_PASSWORD="Your_strong_pw_123" docker compose up -d sql redis

# 2. Apply DB migrations (one-time)
./packages/db/scripts/init-dev-db.sh
pnpm --filter @cems/db db:migrate:deploy

# 3. Set env (copy .env.example to .env at repo root)
cp .env.example .env

# 4. Run the API in watch mode
pnpm --filter api dev

# 5. Smoke test
curl localhost:3001/api/v1/health
curl localhost:3001/api/v1/db-health
curl localhost:3001/api/v1/docs/json | jq '.paths | keys'
```

## Public routes (no auth required)

- `GET /api/v1/health` — liveness probe (always returns 200)
- `GET /api/v1/db-health` — readiness probe (`SELECT 1` against SQL)
- `GET /api/v1/docs` — Swagger UI
- `GET /api/v1/docs/json` — raw OpenAPI 3.0 spec
- `POST /api/v1/auth/login` — Story 1.1
- `POST /api/v1/auth/refresh` — Story 1.1

Adding a public route requires updating `apps/api/src/middleware/auth.ts` `PUBLIC_ROUTES` set + an architecture-review note in the next story's Dev Notes.

## Tenant-scoped data access — `req.withRls(fn)`

**Mandatory pattern.** Every route handler that touches tenant-scoped tables MUST use the request-scoped helper:

```typescript
app.get('/api/v1/audits', async (req) => {
  const audits = await req.withRls(async (tx) => {
    // tx is a Prisma.TransactionClient pinned to ONE connection.
    // SESSION_CONTEXT (tenant_id, user_id, user_role, assigned_store_ids) is set
    // on this connection. Every model OR raw query inside fn inherits it.
    return tx.audit.findMany({ where: { /* tenant filter automatic via RLS */ } })
  })
  return audits
})
```

**Forbidden** (silently bypasses RLS, leaks cross-tenant data):

```typescript
import { prisma } from '@cems/db'
const audits = await prisma.audit.findMany()           // ❌ no RLS context
const rows = await prisma.$queryRaw`SELECT ...`        // ❌ no RLS context
```

The middleware enforces this:
- Inside `req.withRls(async (tx) => ...)`, `tx.$queryRaw` and `tx.$executeRaw` are SAFE — they share the pinned connection where SESSION_CONTEXT is set.
- A direct `prisma.*` call outside `req.withRls` runs on whatever connection the pool returns — likely contaminated with another request's SESSION_CONTEXT. Tenant isolation is broken.

Special case: `/api/v1/db-health` deliberately uses `prisma.$queryRaw\`SELECT 1\`` because:
1. It's a public health probe (no `req.rlsContext` available).
2. `SELECT 1` doesn't read any tenant table.
3. The route's JSDoc explicitly forbids reading tenant data here.

## Errors — RFC 7807 Problem Details

Every error response is JSON with `Content-Type: application/problem+json` and the shape:

```json
{
  "type": "https://cems.starenergy.ca/errors/<slug>",
  "title": "Human-readable summary",
  "status": 422,
  "detail": "Specific message about THIS occurrence",
  "instance": "/api/v1/audits/abc/sections/general",
  "errors": [{ "field": "grossArea", "message": "Must be positive" }]
}
```

| Slug | HTTP | When |
|---|---|---|
| `validation-error` | 422 | Zod or Ajv validation failure |
| `authentication-required` | 401 | Missing/invalid JWT |
| `forbidden` | 403 | Valid JWT, insufficient role/scope |
| `not-found` | 404 | Resource doesn't exist |
| `conflict` | 409 | Stale write / concurrent update |
| `payload-too-large` | 413 | Body limit exceeded |
| `internal-error` | 500 | Unhandled errors (no stack in body) |
| `service-unavailable` | 503 | DB/Redis down |

Use `app.httpErrors.*` (from `@fastify/sensible`) — never `throw new Error()`:

```typescript
if (!audit) throw app.httpErrors.notFound(`audit ${id} not found`)
if (audit.tenantId !== ctx.tenantId) throw app.httpErrors.forbidden('cross-tenant access')
```

## Logging — structured Pino

Every request emits one `info` line on response. Required fields: `request_id`, `method`, `route`, `status_code`, `duration_ms`, `tenant_id`, `user_id`, `user_role`. Unauth requests have `tenant_id: null` etc. Errors are logged at `error` level with the full `err` field for stack-trace correlation via `request_id`.

Authorization headers and cookies are auto-redacted.

## BullMQ queues

Queue names use the dash-separated convention `cems-{job-type}-{priority}` (BullMQ 5.x rejects `:` in queue names — Redis key separator).

| Queue | Worker location | Status |
|---|---|---|
| `cems-email-notification-low` | `apps/api/src/jobs/email-notification.job.ts` | Skeleton — Story 5.5 fills it |
| `cems-calculation-normal` | (none) | Story 8.1 wires worker |
| `cems-llm-review-normal` | (none) | Story 8.3 |
| `cems-pdf-generation-normal` | (none) | Story 9.1 |

To enqueue a job:

```typescript
import { getQueues, QUEUE_NAMES } from './jobs/queue.js'
const q = getQueues()[QUEUE_NAMES.emailNotification]
await q.add('send-receipt', { to: '...', templateId: '...', tenantId: '...' })
```

## Tests

```bash
pnpm --filter api test              # unit tests (33 cases)
RUN_INTEGRATION=1 REDIS_URL=redis://localhost:6379 \
  pnpm --filter api exec vitest run src/jobs   # BullMQ end-to-end against live Redis (5 cases)
```

The RLS integration test lives in `packages/db/tests/rls.integration.test.ts` and runs against the live SQL Server.

## Deployment

Production (Story 0.6 wires CI/CD) deploys to Azure App Service B3 in Canada Central with Key Vault secret references for all 7 secrets (database-url, jwt-secret, jwt-refresh-secret, azure-storage-connection-string, redis-url, resend-api-key, claude-api-key). The slot-swap pattern (staging slot on prod App Service) gives zero-downtime deploys.
