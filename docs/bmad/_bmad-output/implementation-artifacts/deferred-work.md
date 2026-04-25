# Deferred Work

Items surfaced during code review that are intentionally deferred (not bugs in the story under review — either by-design, future-story scope, or optimisation).

## Deferred from: code review of 0-4-nodejs-api-foundation-and-job-queue-setup (2026-04-25)

**Medium severity (Story 0.5 or 0.6 should pick up):**

- Pino redaction misses bare `password` / `secret` / `token` keys at the top level (paths use `*.password`). Add `password`, `secret`, `token` paths and array-index variants like `*[*].password`. [apps/api/src/lib/logger.ts:18-25]
- Logger eagerly instantiated at module load — every test that transitively imports logger.ts spawns a `pino-pretty` worker thread in dev. Make lazy (`getLogger()` or guarded `_logger`). Other singletons in this story are lazy. [apps/api/src/lib/logger.ts:31-39]
- BullMQ processor uses `parse()` (throws ZodError) instead of `safeParse()` — invalid payloads get retried 3× before going to failed queue. Validate at enqueue + treat parse failures as terminal in worker. [apps/api/src/jobs/email-notification.job.ts:21-22]
- RFC 7807 status mapping missing 429 (rate limit), 502 (bad gateway), 504 (gateway timeout) — fall through to `internal-error` slug. [apps/api/src/middleware/error-handler.ts:7-29]
- `LOG_LEVEL` env var not validated — `LOG_LEVEL=banana` crashes at boot with cryptic Pino error. Validate against literal union and default to `info` with warning. [apps/api/src/lib/logger.ts:6]
- Worker `failed` handler logs but does NOT write to `audit_log` — failures missing from tamper-evident trail. Add `appendLog(...)` via system-tenant context. [apps/api/src/jobs/email-notification.job.ts:43-45]
- OpenAPI `servers: [{ url: '/' }]` should be `/api/v1` per Story 0.4 Task 7 spec — generated client SDKs (Story 0.6 codegen) will mis-prefix paths. [apps/api/src/app.ts:33]
- 4xx `error.message` echoed verbatim to clients via `detail` — risk of PII leak (e.g., `httpErrors.conflict(\`User ${email} exists\`)` leaks email). Define a coding pattern that separates safe-detail from internal-cause. [apps/api/src/middleware/error-handler.ts:103]
- `request.rlsContext` is mutable (no `Object.freeze`) — handler bug or compromised dep can overwrite mid-request. [apps/api/src/middleware/auth.ts:79-84]
- SIGTERM ordering: `app.close()` runs before `stopWorker()`; if a request enqueues a job, the Worker may pick it up after Redis close starts. Drain order should be: stop accepting HTTP → drain Worker → close Redis. (Server now reorders worker-start AFTER listen, but shutdown order still HTTP-first.) [apps/api/src/server.ts:23-29]
- Worker `_worker.close()` uses default behavior — waits for active jobs indefinitely. Pass `force: true` after a deadline to honour k8s SIGKILL grace period. [apps/api/src/jobs/email-notification.job.ts:55]
- BullMQ `removeOnComplete: { age: 3600, count: 1000 }` — high retention; reduce to `count: 100`, age `1h`. [apps/api/src/jobs/queue.ts:8]
- `closeQueues` / `closeRedisConnection` not concurrency-safe — racing SIGTERM+SIGINT could double-close. Add per-resource lock. [apps/api/src/jobs/queue.ts:46-50, lib/redis.ts:21-25]

**Low severity (revisit when convenient):**

- `Date.now()` ms resolution for request timing — `duration_ms: 0` for fast routes. Use `process.hrtime.bigint()`. [apps/api/src/app.ts:38-50]
- `as unknown as FastifyInstance` cast at buildApp — type-safety hole. Find a typed alternative or document the constraint loudly. [apps/api/src/app.ts:25]
- `request.routeOptions?.url ?? request.url` — for 404s, falls back to raw URL with query string → log cardinality blowup. Use literal `'<unknown>'` fallback. [apps/api/src/app.ts:61]
- `disableRequestLogging: true` may suppress onTimeout / connection-error log lines. Add `onRequestAbort` and `onTimeout` hooks. [apps/api/src/app.ts:24]
- `genReqId` discards incoming `x-request-id` header — trace propagation lost. Either accept the header or document why stripped. [apps/api/src/app.ts:23]
- `globalThis.__cemsPrisma` cache survives `DATABASE_URL` mutation in dev — hot reload may use stale URL. Invalidate when env URL differs from cached. [packages/db/src/index.ts:18-22]
- Architecture.md still documents `cems:{type}:{priority}` colon-separated queue names — BullMQ 5.x rejects `:`. Update architecture doc. [docs/bmad/_bmad-output/planning-artifacts/architecture.md § BullMQ]
- Replay protection (`jti` claim, nonce, server-side revocation) — Story 1.1 (token issuance + refresh rotation).
- Tenant-route binding defense-in-depth (e.g., reject token for tenant A used on a tenant-B-scoped route) — Story 1.2 (RBAC route guards).
- Re-entrancy detection in `withRlsTransaction` — Prisma rejects nested interactive tx with opaque error. Add detection + clear error message. [packages/db/src/middleware/rls.ts:65-83]
- `apps/admin-app/vite.config.ts.timestamp-*.mjs` artefact may have leaked into git from an earlier build. Verify and purge if so.
- ESLint rule forbidding direct `prisma.$queryRaw` on tenant tables — Story 0.6 CI/lint hardening.

## Deferred from: code review of 0-3-database-schema-and-rls-foundation (2026-04-25)

**Story 0.4 must address these before real auth traffic lands:**

- **RLS raw-query bypass** [packages/db/src/middleware/rls.ts] — `$extends` only hooks `$allModels.$allOperations`; `$queryRaw`/`$executeRaw` skip the middleware. Story 0.4 establishes per-request connection-affinity via interactive `$transaction` or a `withRlsTransaction(ctx, fn)` helper that pins the connection.
- **Pool-interleaving race** [rls.ts:53-57] — 4 `sp_set_session_context` EXEC calls + 1 query = 5 round-trips; Prisma's pool can hand each a different connection. SESSION_CONTEXT lands on one connection, query on another → RLS predicate sees empty context. Same fix as above.
- **`$transaction` batch form skips middleware** [rls.ts] — Interactive `$transaction(async (tx) => ...)` passes raw `tx`. Batch form `$transaction([p1, p2])` executes on potentially a different connection. Address with `withRlsTransaction` helper in Story 0.4.
- **RLS middleware performance (4 round-trips/query)** [rls.ts:53-56] — Batch into a single `security.sp_set_rls` stored procedure after Story 0.4 lands connection-affinity.

**Lower priority, story-specific:**

- `appendLog` JSON.stringify throws on BigInt/circular [apps/api/src/repositories/audit-log.repo.ts:35] — first real callers in Story 7.3 (state machine); add safe serializer then.
- `appendLog` no payload size cap (NVARCHAR(MAX) = 2GB) — Story 7.3.
- `appendLog` doesn't accept a `tx` client — Story 7.3.
- `assignedStoreIds` stored as string JSON blob, no DB validation — Story 1.1 (auth) tightens.
- Empty-string element in `assignedStoreIds` bypasses CLIENT filter (`z.array(z.string().min(1))`) — Story 1.1.
- `EXEC()` sub-batches not wrapped in migration transaction — hardening story; add `IF NOT EXISTS` idempotent guards.
- `WITH SCHEMABINDING` locks future column additions to `audits`/`users` — documented pattern; future schema migrations must DROP+RECREATE policy + function.
- ADMIN bypass allows typo'd `tenant_id` on INSERT — later story adds `tenants` reference table with FK check.
- Concurrent vitest runs clobber each other's seed data [tests/rls.integration.test.ts] — with integration test wiring.
- Integration test mutates shared state without `beforeEach` — with integration test wiring.
- FK `ON UPDATE CASCADE` on auto-gen FKs (PKs are cuids; not exercised today) — future schema refinement.
- `auditorUserId` NoAction orphans sessions on user delete — Story 1.3 implements soft-delete.
- `Proxy` breaks `instanceof`/`JSON.stringify`/`util.inspect` [packages/db/src/index.ts] — cosmetic; revisit post-Story 0.4.
- `init-dev-db.sh` brittle grep/retry/sqlcmd-path — Story 0.6 CI hardening.
- Redundant indexes (`idx_users_tenant_id` covered by `uq_users_tenant_email`) — perf tuning pass.
- Filtered index for `audit_log.audit_id` (mostly null) — Story 7.3 perf.
- `tenant_id NVARCHAR(1000)` vs Dev Notes `NVARCHAR(50)` drift — negligible; align in future migration.
- `prisma.config.ts` silent on missing DATABASE_URL — Prisma CLI's own error is acceptable.

## Deferred from: code review of 0-2-azure-infrastructure-provisioning (2026-04-24)

- **SAS token no stored access policy** [apps/api/src/lib/azure-blob.ts] — defense-in-depth gap; revisit when user-delegation SAS is introduced post-auth wiring
- **KV reference URI concatenation format brittle** [modules/appservice.bicep:30] — cosmetic; `VaultName=...;SecretName=...` form would be cleaner
- **`data-subnet` created but unused** [modules/network.bicep:57-64] — by design, reserved for private endpoints in staging+prod
- **`redisSku` object param loosely typed** [modules/redis.bicep:27] — tighten when Bicep user-defined types used project-wide
- **`sqlFirewallIpRanges` docstring inaccurate** [envs/dev/main.bicepparam:41] — wire up when developer IP allowlist is actually needed
- **`Buffer.from(data)` UTF-8 assumption** [apps/api/src/lib/azure-blob.ts:45-46] — document encoding contract in JSDoc
- **`.gitignore infra/bicep/**/*.json` glob broad** [.gitignore] — revisit if a non-compiled JSON artefact is intentionally added under infra
- **`uniqueString` same hash across services** [multiple modules] — low collision risk; revisit if a service name is ever globally taken
- **App Service `PORT=8080` vs `WEBSITES_PORT`** [modules/appservice.bicep:65] — works on Linux default; add defensive WEBSITES_PORT when 502s observed
- **`containers-subnet` /23 oversized** [modules/network.bicep] — Azure CA consumption env minimum met; flagged for future subnet-addition discipline
- **Storage account name non-deterministic on RG recreation** [modules/storage.bicep:24] — documented teardown procedure
- **Key Vault name collision after soft-delete** [modules/keyvault.bicep] — 30-day name lockout in staging+prod; documented in README teardown
- **`DEPLOYMENT_NAME` second-granular timestamp** [deploy.sh:73] — deploy.sh is serial; upgrade to nanosecond or UUID when parallel deploys exist
- **`FAKE_ACCOUNT_KEY` in test is fake base64** [azure-blob.test.ts:4] — SDK accepts it today; may tighten on future minor
- **Container Apps `maxReplicas` partial override quirk** [modules/containerapps.bicep] — bicepparam files are full objects today
- **SWA region `eastus2` vs compute `canadacentral`** — architecture accepts cross-region CDN; documented in README
- **`enablePurgeProtection: ... ? true : null` pattern** [modules/keyvault.bicep:51] — works correctly (one-way irreversible flag); add docstring clarifying semantics
- **Calc container has no secret refs despite MI + RBAC wiring** [modules/containerapps.bicep] — Story 0.5 (real calc image) wires them
- **SWA `canadacentral` never attempted before `eastus2` fallback** [envs/*/main.bicepparam] — Dev Notes explicitly permits direct fallback

## Deferred from: code review of 0-1-turborepo-monorepo-and-shared-package-scaffold (2026-04-21)

- **Fastify binds 0.0.0.0, no auth/CORS/body limit** [apps/api/src/app.ts] — Story 0.4 (API Foundation) wires JWT auth, RFC 7807 error handler, `@fastify/cors`, OpenAPI registration, and Pino request logging.
- **FastAPI no CORS/trusted-host/body-size middleware** [apps/calc-service/app/main.py] — Story 0.5 (Calc Service Scaffold) hardens the service; internal VNet ingress means no public exposure anyway.
- **`schema.prisma` empty with `db:generate` wired** [packages/db/prisma/schema.prisma] — Story 0.3 populates full schema (audits, audit_sections, users, user_sessions, compressor_refs, store_refs, section_locks, audit_log).
- **Packages export `./src/*.ts` with no build step** [packages/*/package.json] — intentional for MVP; apps consume via TS path aliases. Revisit if any package needs to ship as a library.
- **Three identical copies of api-client / queryClient / index.css across apps** [apps/*/src/lib] — extract to shared `@cems/http` package after first feature story lands and hardens the patterns.
- **No root `eslint` config or `eslint` dep; `pnpm lint` will fail** [root] — Lint wiring not required by Story 0.1 ACs. Add flat-config + `eslint` + `typescript-eslint` + `eslint-plugin-react` when formalising code-quality gate.
- **Unused declared deps** — puppeteer, resend, jose, bullmq, @azure/storage-blob, @fastify/swagger [apps/api/package.json] — pinned now to lock versions; exercised in Stories 0.4+.
- **`turbo.json` lacks `inputs`/`env`/`passThroughEnv`** [turbo.json] — cache optimisation; tighten when CI runs start caching.
- **`type-check` depends on `^build` but packages have `noEmit: true`** [turbo.json] — wasted cache keys, not a correctness bug.
- **`test` pipeline depends on `build` but TS packages have no tests** [turbo.json] — refactor when first tests land.
- **`queryClient.retry: 2` retries on 401/403** [apps/*/src/lib/queryClient.ts] — tune when Story 1.1 (auth) lands; auth failures should not retry.
- **`generalSectionSchema.auditDate` unvalidated string** [packages/types/src/forms/general.schema.ts] — form schemas are stubs; per-section tightening in Epics 2–5.
- **`PHOTO_ACCEPTED_TYPES` omits `image/heif`, `image/webp`** [packages/types/src/index.ts] — Story 4.1 (Camera Capture) reconciles with UX spec.
- **`AuditSection.data: Record<string, unknown>` loses type safety** [packages/types/src/audit.ts] — refine to discriminated union once section schemas finalise.
- **`apps/api/src/app.ts` doesn't register Swagger/CORS/validators despite declared deps** [apps/api/src/app.ts] — Story 0.4 wires all middleware.
- **`requirements.txt` no hash pinning, no ruff/mypy** [apps/calc-service] — Python tooling hardening in Story 0.5.
- **`typescript` devDep duplicated in every package** [packages/*/package.json] — hoist-to-root refactor; low priority.
