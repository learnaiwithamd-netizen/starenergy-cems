# Deferred Work

Items surfaced during code review that are intentionally deferred (not bugs in the story under review — either by-design, future-story scope, or optimisation).

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
