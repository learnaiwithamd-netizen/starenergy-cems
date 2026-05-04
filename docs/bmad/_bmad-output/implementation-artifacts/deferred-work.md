# Deferred Work

Items surfaced during code review that are intentionally deferred (not bugs in the story under review — either by-design, future-story scope, or optimisation).

## Deferred from: code review of 0-6-ci-cd-pipeline (2026-05-01)

Items from the Story 0.6 review pass. The 8 P0/HIGH issues were patched at review time (see story Review Findings); below are defense-in-depth and architectural-rework items.

- **PR-triggered SWA preview job exposes long-lived deploy tokens** to any same-repo PR contributor. Architectural fix: decouple via `pull_request_target` + `workflow_run`. Future hardening story. [`.github/workflows/ci.yml::swa-preview`]
- **Slot-swap rollback theatrical** — `/api/v1/health` is static. Switch post-swap smoke to a deeper health endpoint composing `/db-health` + a calc round-trip. [`.github/workflows/deploy-staging.yml::deploy-api`, `deploy-prod.yml::deploy-api`]
- **Slot swap doesn't drain in-flight requests** — Azure atomic at LB but in-flight connections cut. Revisit if long-running endpoints land. [`deploy-staging.yml`/`deploy-prod.yml::deploy-api`]
- **Slot swap doesn't restart workers / re-resolve KV refs** — KV propagation 30-120s eventually consistent. Add `az webapp restart` post-swap if observed. [Same as above]
- **AC 7 deviation: `az containerapp update` shortcut** vs spec's `az deployment ... --parameters calcServiceImageTag`. Functionally correct but bypasses the "infra-as-code carries the SHA" intent. [`deploy-staging.yml::deploy-calc`, `deploy-prod.yml::deploy-calc`]
- **`bicepparam calcServiceImageTag = 'latest'` default** — relevant only if someone runs `az deployment` outside CI. Tighten to empty-string default + Bicep-side guard. [`infra/bicep/envs/*/main.bicepparam`, `infra/bicep/modules/containerapps.bicep:24`]
- **Schema-drift brace counter is string/comment/template-literal blind** — false matches on `{`/`}` inside strings/comments. Replace with TS-AST when needed. [`scripts/compare-zod-shape.mjs:78-103`]
- **Schema-drift `properties` blindspot** — Pydantic `Union[A, B]` / `RootModel` / `anyOf` composition emits no `properties` key; comparator falsely flags as drift. Extend comparator when the first such model lands. [`scripts/compare-zod-shape.mjs:112`]
- **OIDC subject case-sensitivity** — repo rename silently breaks all deploys. Add rename-runbook entry. [`infra/README.md`]
- **Federated identity → role assignment race on first deploy** — Azure AD principal-id propagation 30-120s. Runbook documents symptom; consider `principalType: 'ServicePrincipal'` opt-in if observed. [`infra/bicep/main.bicep::githubAcrAccess`]
- **Migrate has no rollback** — partial migration leaves `_prisma_migrations` failed; needs manual `prisma migrate resolve --rolled-back`. Operational, outside CI scope. [`deploy-staging.yml::migrate`, `deploy-prod.yml::migrate`]
- **Migrate runs against whatever KV returns** — no env-name assertion on DATABASE_URL. Add a defensive `host =~ /staging|prod/` check. [Same]
- **ACR push 429 retry** — Basic SKU rate-limits writes. No retry on `docker/build-push-action@v6`. [`deploy-staging.yml::build-images`, `deploy-prod.yml::build-images`]
- **buildx cache scope per-env** — prod rebuilds rather than copying the staging image digest. Switch to artifact-promotion post-MVP. [Same]
- **CI doesn't run on direct pushes to non-default branches** — only `pull_request: branches: [main]` wired. [`.github/workflows/ci.yml`]
- **SWA preview never cleaned on PR close** — no `closed` activity-type handler with `action: close`. Preview envs accumulate. [`.github/workflows/ci.yml::swa-preview`]
- **CI concurrency cancel-in-progress mid-SWA-upload** — partial upload + stale sticky comment possible. Low impact. [`.github/workflows/ci.yml`]
- **Final smoke probes `/api/v1/health` only** — no SPA or calc round-trip. Add when Story 8 lands. [`deploy-staging.yml::health-check`]
- **`gh release create` no fallback under tag-protection rules** — no `--clobber` or graceful failure. Cosmetic. [`deploy-prod.yml::tag-release`]
- **`verify-staging` accepts ANY past success** — doesn't check workflow file SHA / run timestamp. Could promote a SHA validated by an inferior pipeline. [`deploy-prod.yml::verify-staging`]

---

## Deferred from: code review of 0-5-python-calculation-service-scaffold (2026-04-28)

Findings from the Story 0.5 code review (Blind + Edge Case + Acceptance auditors). The 7 HIGH-severity items were patched at review time; everything below is defense-in-depth, future-story scope, or a deliberate architectural trade-off.

- ACR `publicNetworkAccess: 'Enabled'` — Basic and Standard SKUs cannot use private endpoints; Premium + private endpoint is the proper fix. Story 0.6 ops hardening. [`infra/bicep/modules/acr.bicep`]
- Module-singleton breaker shared across all 3 calc endpoints — one endpoint's failure rate poisons the others. Architectural; revisit when real call patterns show contagion. [`apps/api/src/lib/calc-service-client.ts`]
- `_baseUrl` cache and `_breaker` singleton are not invalidated on env change / hot reload — production secret rotation requires a process restart by design. [`apps/api/src/lib/calc-service-client.ts`]
- `__testing__` hooks exported from production module — common pattern; no enforcement mechanism yet. [`apps/api/src/lib/calc-service-client.ts`]
- Logger `_redact_in_place` mutates the caller's `extra` dict (aliasing surprise) — copy-on-redact would be cleaner. [`apps/calc-service/app/lib/logger.py`]
- Logger `time` (renamed from `asctime`) coexists with python-json-logger's `timestamp=True` — possible duplicate field; cosmetic. [`apps/calc-service/app/lib/logger.py`]
- `extra={"err": repr(exc)}` in `unhandled_exception_handler` may write secret-bearing exception messages to log destination — Story 0.4-style key-name redaction does not catch values inside `repr()`. [`apps/calc-service/app/lib/error_handler.py`]
- BaseHTTPMiddleware buffers entire response body — Story 8 may emit large `line_items[]`; switch to ASGI raw middleware then. [`apps/calc-service/app/lib/middleware.py`]
- `Field(min_length=0)` on `compressors` and `monthly_consumption` — matches story spec literally; tighten to `min_length=1` (or stricter validators) when Story 8 lands real math. [`apps/calc-service/app/models/{ecm,baseline}.py`]
- `temperature_f` upper bound of 200°F is physically out of range for refrigerant operation — narrow when real lookup tables land in Story 8.3. [`apps/calc-service/app/models/refrigerant.py`]
- `RefrigerantResponse.refrigerant_type: str` (vs `Literal` on request) — response can echo any value. Tighten when Story 8.3 lands.
- `acrRoleAssignment.bicep` has no explicit `dependsOn` on the ACR module — implicit via output reference works in practice but partial deploys could surface a race.
- `bicepparam` files use `latest` image tag — Story 0.6 CI will replace with the SHA-pinned tag from the build pipeline.
- `calc-service-client.ts` does not classify upstream 4xx (e.g., the calc service's own 422) — currently mapped to `UPSTREAM_ERROR`. Distinguish caller-bad-request from service-bad-request when Story 8 tightens calc inputs.
- `DEFAULT_TIMEOUT_MS` hardcoded — make tunable via `CALC_SERVICE_TIMEOUT_MS` env once Story 8 reveals real call latency profiles.
- `problemDetailSchema.type` requires `z.string().url()` — RFC 7807 §3.1 permits relative URI references. Loosen if a non-absolute `type` is ever emitted. [`packages/types/src/api.ts`]
- Cold-start `ImagePullBackOff` possibility — `minReplicas=0` + first-deploy ACR role propagation (30–120s eventually consistent) could hit a window where the calc app fails to pull. Add explicit `dependsOn` + post-deploy restart if observed.
- AC 5 "5 consecutive failures" semantics — current opossum config opens after 5 calls AND ≥50% error rate (which is met by 5 consecutive failures, but also by mixed traffic patterns). The strict-consecutive interpretation needs a hand-rolled counter; revisit if call patterns show this matters.

---

## Deferred from: code review of 0-4-nodejs-api-foundation-and-job-queue-setup (2026-04-28, second pass)

Findings from a second-pass review (Blind Hunter + Edge Case Hunter + Acceptance Auditor) after the first review's 9 HIGH patches landed. None block the story; all are defense-in-depth, future-story scope, or architectural revisits.

- JWT validation does not enforce `iss`/`aud` — Story 1.1 token issuance scope. [apps/api/src/middleware/auth.ts:96-103]
- `getJwtSecret()` cache retains plaintext secret bytes in module memory — defense-in-depth tradeoff; revisit when KMS/Key Vault SDK is wired. [apps/api/src/middleware/auth.ts:55-71]
- `req.withRls` decorator default `null` — calls on public/auth-failed routes throw `TypeError`. Replace with sentinel function in Story 0.5. [apps/api/src/middleware/rls-request.ts:20-32]
- `PUBLIC_STATIC_PREFIX` prefix-match could broaden public surface if swagger-ui ever serves new content under `/static/`. Story 0.6 hardening. [apps/api/src/middleware/auth.ts:28]
- `isPublicRoute` matches `request.url` not `request.routeOptions.url` per Task 4 wording. Functionally equivalent today. [apps/api/src/middleware/auth.ts:39-44]
- `JWT_SECRET` length check is per-request — add boot-time validation in `server.ts` for fail-fast. Story 0.6. [apps/api/src/server.ts]
- `Authorization` header could arrive as `string[]`; `.replace` would throw. Story 1.1. [apps/api/src/middleware/auth.ts:83-90]
- `assignedStoreIds` has no `.max(N)` cap — large arrays could exceed MSSQL `session_context` 256KB limit. Story 1.1. [apps/api/src/middleware/auth.ts:34]
- BullMQ `removeOnFail: { age: 86400 }` has no `count` cap — failed-job storm could OOM Redis. Story 0.6. [apps/api/src/jobs/queue.ts:7]
- `clearSessionContext` runs in `finally` after rolled-back tx — MSSQL may abort the cleanup `EXEC`. Document semantics + revisit cleanup mechanism. [packages/db/src/middleware/rls.ts:99-110]
- `clearSessionContext` uses `''` for tenant_id — adopt sentinel like `__cleared__` to defend against any tenant accidentally provisioned with empty id. [packages/db/src/middleware/rls.ts:104-108]
- Error handler does not check `reply.sent` before `reply.code(...).send(...)`. Edge: error-after-early-reply double-sends. Story 0.6. [apps/api/src/middleware/error-handler.ts]
- `ZodError.path` joins to empty string for root-level errors — `field: ''` in `errors[]` confuses clients. [apps/api/src/middleware/error-handler.ts:62]
- `fastifySchemaFromZod` uses Ajv on derived JSON Schema while handlers may `safeParse` directly — two-validator drift. Revisit if observed in practice. [apps/api/src/lib/schema.ts]
- `OPTIONS` preflight on protected routes returns 401 (no CORS). Story 1.1 CORS wiring. [apps/api/src/middleware/auth.ts]
- `db-health` raw `$queryRaw` throws on DB-unreachable → 500 instead of `{db:'unreachable'}` per spec response shape. Wrap in try/catch. Story 0.6 health-check polish. [apps/api/src/app.ts:107-110]

---

## Deferred from: code review of 0-4-nodejs-api-foundation-and-job-queue-setup (2026-04-25)

**Medium severity (Story 0.5 or 0.6 should pick up):**

- Pino redaction misses bare `password` / `secret` / `token` keys at the top level (paths use `*.password`). Add `password`, `secret`, `token` paths and array-index variants like `*[*].password`. [apps/api/src/lib/logger.ts:18-25]
- Logger eagerly instantiated at module load — every test that transitively imports logger.ts spawns a `pino-pretty` worker thread in dev. Make lazy (`getLogger()` or guarded `_logger`). Other singletons in this story are lazy. [apps/api/src/lib/logger.ts:31-39]
- BullMQ processor uses `parse()` (throws ZodError) instead of `safeParse()` — invalid payloads get retried 3× before going to failed queue. Validate at enqueue + treat parse failures as terminal in worker. [apps/api/src/jobs/email-notification.job.ts:21-22]
- RFC 7807 status mapping missing 429 (rate limit), 502 (bad gateway), 504 (gateway timeout) — fall through to `internal-error` slug. [apps/api/src/middleware/error-handler.ts:7-29]
- `LOG_LEVEL` env var not validated — `LOG_LEVEL=banana` crashes at boot with cryptic Pino error. Validate against literal union and default to `info` with warning. [apps/api/src/lib/logger.ts:6]
- Worker `failed` handler logs but does NOT write to `audit_log` — failures missing from tamper-evident trail. Add `appendLog(...)` via system-tenant context. [apps/api/src/jobs/email-notification.job.ts:43-45]
- ~~OpenAPI `servers: [{ url: '/' }]` should be `/api/v1`~~ **Fixed in 2026-04-28 second-pass review.**
- 4xx `error.message` echoed verbatim to clients via `detail` — risk of PII leak (e.g., `httpErrors.conflict(\`User ${email} exists\`)` leaks email). Define a coding pattern that separates safe-detail from internal-cause. [apps/api/src/middleware/error-handler.ts:103]
- ~~`request.rlsContext` is mutable (no `Object.freeze`)~~ **Fixed in 2026-04-28 second-pass review.**
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
- ~~`apps/admin-app/vite.config.ts.timestamp-*.mjs` artefact may have leaked into git~~ **Fixed in 2026-04-28 second-pass review:** removed from git + glob added to `.gitignore`.
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
