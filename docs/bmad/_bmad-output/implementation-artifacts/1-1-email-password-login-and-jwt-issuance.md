# Story 1.1: Email/Password Login & JWT Issuance

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a user (Auditor, Admin, or Client),
I want to log in with my email and password,
so that I receive a JWT that grants me access to exactly the surfaces and data my role permits.

**Source:** [docs/bmad/_bmad-output/planning-artifacts/epics.md#Story-1.1](../planning-artifacts/epics.md) lines 517–547. Covers FR38 (authentication). Lays the foundation for FR41 (role-based interface access — Story 1.2) and FR42 (row-level data isolation — Story 1.4).

**Scope clarification:** This story is **API-only**. It ships the `/api/v1/auth/login`, `/api/v1/auth/refresh`, and `/api/v1/auth/logout` endpoints, password hashing, JWT issuance with role-specific TTLs, and refresh-token rotation. The SPA login form, token persistence, and Authorization-header interceptor are deferred to **Story 1.2** (Role-Based Surface Access & Route Guards), which builds the UI on top of these APIs. Developers can exercise this story end-to-end via `curl` / Postman.

## Acceptance Criteria

1. **AC1 — `POST /api/v1/auth/login` issues role-scoped tokens on valid credentials.** Body `{ email, password }`. On match against an active user: returns `{ accessToken, refreshToken, tokenType: 'Bearer', expiresIn }` where `accessToken` is an HS256 JWT with claims `{ sub, tenantId, role, assignedStoreIds, iat, exp }`. Access TTL is **8h for AUDITOR, 4h for ADMIN, 4h for CLIENT** (per architecture.md Category 2). `refreshToken` is a 64-byte cryptographically-random secret returned base64url-encoded; only its SHA-256 hash is persisted to `user_sessions.refresh_token_hash`. Refresh TTL: **7d for AUDITOR, 1d for ADMIN, 1d for CLIENT**. The new `user_sessions` row is inserted via the system-auth context (RLS bypass — see Dev Notes).

2. **AC2 — Login failure returns RFC 7807 401 with no enumeration leak.** Wrong password, non-existent email, or malformed payload all return the **same** problem-detail shape: `{ type: '…/authentication-required', title: 'Unauthorized', status: 401, detail: 'Invalid email or password', instance }`. Implementation must run an argon2 verify against a precomputed dummy hash even when the user is not found, so request timing does not distinguish the two failure modes. Malformed payload (empty email, empty password, non-string fields) returns 422 with errors array — separate path from the credential-mismatch 401.

3. **AC3 — JWT verification on protected routes does not hit the database.** The existing `apps/api/src/middleware/auth.ts` hook validates HS256 + claims schema and populates `request.rlsContext` purely from the token payload. No `prisma.user.findFirst({ where: { id: claims.sub } })` lookup per request. (This is already wired by Story 0.4; this AC is satisfied by *not regressing* it. The story's tests must demonstrate 0 user-table queries on a protected route.)

4. **AC4 — Expired access token returns RFC 7807 401 with `type: '…/token-expired'`.** When `jose.jwtVerify` throws `JWTExpired`, the auth middleware surfaces a `TokenExpiredError` (custom subclass of Error) that the global error handler maps to slug `'token-expired'`. All other token-validation failures (bad signature, malformed payload, claims schema mismatch) keep the existing slug `'authentication-required'`. The 5-second clock tolerance currently in `auth.ts` is preserved.

5. **AC5 — `POST /api/v1/auth/refresh` rotates the refresh token and revokes the old one.** Body `{ refreshToken }`. Lookup by SHA-256 hash via system-auth context: row must exist, `revokedAt` must be null, `expiresAt` must be in the future. On success: issue a fresh access token + a brand-new refresh token (gen → hash → persist as new row), then **delete** the old session row (atomic — same Prisma transaction). Response shape mirrors `/login`. On any failure path (token unknown, revoked, expired): RFC 7807 401 `'…/authentication-required'` — same generic shape, no enumeration. The endpoint is in the existing `PUBLIC_ROUTES` set (no Authorization header required).

6. **AC6 — `POST /api/v1/auth/logout` revokes the refresh token.** Body `{ refreshToken }`. Lookup via system-auth context, delete the matching `user_sessions` row. Returns 204 No Content on success and on the unknown-token case alike (idempotent — never reveal whether the token was valid). Add `/api/v1/auth/logout` to `PUBLIC_ROUTES` so logout works after the access token has expired. After a successful logout, calling `/auth/refresh` with the same refresh token must return 401.

## Tasks / Subtasks

- [ ] **Task 1 — Add password hashing primitives (AC: #1, #2)**
  - [ ] Add `argon2@^0.41.1` to `apps/api/package.json` dependencies. Run `pnpm install` from repo root; verify lockfile updates cleanly.
  - [ ] Create `apps/api/src/lib/passwords.ts` exporting:
    - `hashPassword(plaintext: string): Promise<string>` → wraps `argon2.hash` with `type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1` (OWASP 2024 minimum recommendations for Argon2id).
    - `verifyPassword(hash: string, plaintext: string): Promise<boolean>` → wraps `argon2.verify`, returns false on any thrown error (malformed hash, etc.) — never bubbles.
    - `DUMMY_PASSWORD_HASH` — a precomputed argon2id hash of a random 32-byte string, embedded as a constant. Used by login service to consume time when user is not found (constant-time-ish defense).
  - [ ] Add `apps/api/src/lib/passwords.test.ts`: round-trip (hash → verify true), wrong password (verify false), malformed hash input (verify false), `DUMMY_PASSWORD_HASH` exists and verifies false against any known plaintext (sanity).

- [ ] **Task 2 — Add token issuance + refresh-token primitives (AC: #1, #5)**
  - [ ] Create `packages/types/src/auth.ts`:
    - `loginRequestSchema` (Zod): `email: z.string().email().max(254)`, `password: z.string().min(1).max(256)`.
    - `loginResponseSchema`: `accessToken: string`, `refreshToken: string`, `tokenType: z.literal('Bearer')`, `expiresIn: z.number().int().positive()`.
    - `refreshRequestSchema`: `refreshToken: z.string().min(1)`.
    - `logoutRequestSchema`: same as refreshRequestSchema.
    - `accessTokenClaimsSchema`: matches the existing `jwtClaimsSchema` in `apps/api/src/middleware/auth.ts` (sub, tenantId, role, assignedStoreIds, iat, exp). Move/duplicate it here so frontend + API both reference the canonical shape.
    - Constants: `ACCESS_TOKEN_TTL_BY_ROLE: Record<UserRole, number>` (seconds) and `REFRESH_TOKEN_TTL_BY_ROLE: Record<UserRole, number>` (seconds) — Auditor 28800/604800, Admin 14400/86400, Client 14400/86400.
  - [ ] Re-export from `packages/types/src/index.ts`.
  - [ ] Update `apps/api/src/middleware/auth.ts` to import `accessTokenClaimsSchema` from `@cems/types` instead of redeclaring locally. Keep `__testing__` exports for back-compat.
  - [ ] Create `apps/api/src/lib/tokens.ts`:
    - `issueAccessToken(user: { id, tenantId, role, assignedStoreIds }): Promise<{ token, expiresIn }>` → `new SignJWT(claims).setProtectedHeader({alg:'HS256'}).setIssuedAt().setExpirationTime(now + ttl).sign(getJwtSecret())`.
    - `generateRefreshToken(): { token, hash, expiresAt }` where `token = base64url(randomBytes(64))`, `hash = sha256(token)` (hex), `expiresAt = new Date(Date.now() + ttl * 1000)`. **Caller passes role to determine TTL** — signature: `generateRefreshToken(role: UserRole)`.
    - `hashRefreshToken(token: string): string` — SHA-256 hex; pure function used at lookup time.
    - `getJwtSecret(): Uint8Array` — extracted from `auth.ts` so both sign and verify share one cache. (Move the existing implementation from `auth.ts` here; auth.ts imports from `tokens.ts`.)
  - [ ] Add `apps/api/src/lib/tokens.test.ts`: sign + verify round-trip; access token has correct `exp` per role (3 cases: Auditor 8h, Admin 4h, Client 4h with ±2s slack); refresh token is base64url and 64+ bytes after decode; `hashRefreshToken(token)` is deterministic; `getJwtSecret` throws on missing/short secret.

- [ ] **Task 3 — Add system-auth context + repositories (AC: #1, #5, #6)**
  - [ ] Create `apps/api/src/lib/system-auth-context.ts`:
    - Exports `SYSTEM_AUTH_CONTEXT: Readonly<RlsContext>` with `tenantId: '__auth_system__'`, `userId: '__auth_system__'`, `role: UserRole.ADMIN`, `assignedStoreIds: []`, frozen with `Object.freeze`.
    - Exports `withSystemAuth<T>(fn): Promise<T>` — wrapper around `withRlsTransaction(prisma, SYSTEM_AUTH_CONTEXT, fn)`.
    - Heavy JSDoc block documenting **why this exists**: the auth flow has no caller-supplied tenant context until *after* user lookup, so it must use a sanctioned RLS bypass. Mention the OR-ADMIN clause in `security.fn_tenant_predicate` makes role=ADMIN bypass the tenant filter; this context exploits that intentionally and is only safe in routes that immediately scope to the resolved user's actual tenant on the very next operation.
    - Add a `// eslint-disable-next-line cems/no-tenant-raw-prisma -- AUDIT-REVIEWED: …` comment if any `$queryRaw` is used (none expected — pure Prisma model calls).
  - [ ] Create `apps/api/src/repositories/user.repo.ts` exporting `findActiveUserByEmail(email)` → calls `withSystemAuth(tx => tx.user.findFirst({ where: { email } }))`. Returns `User | null`. (Schema currently lacks a `status` field; once Story 1.3 adds it, this query gains `AND status = 'ACTIVE'`. Document this as a deferred-tightening note.)
  - [ ] Create `apps/api/src/repositories/user-session.repo.ts`:
    - `createSession(tx, { tenantId, userId, refreshTokenHash, expiresAt })` → inserts row.
    - `findActiveSessionByHash(refreshTokenHash)` → `withSystemAuth(tx => tx.userSession.findFirst({ where: { refreshTokenHash, revokedAt: null, expiresAt: { gt: new Date() } } }))`.
    - `deleteSessionByHash(tx, refreshTokenHash)` → `tx.userSession.deleteMany({ where: { refreshTokenHash } })`. (deleteMany so unknown-token logout is idempotent.)
    - Tests in `*.test.ts` using a Prisma mock — verify each function builds the right `where` clauses; integration tests (real DB) deferred to a follow-up if time permits.

- [ ] **Task 4 — Add auth service (login, refresh, logout) (AC: #1, #2, #5, #6)**
  - [ ] Create `apps/api/src/services/auth.service.ts` with three exports:
    - `login({ email, password })`: lookup user via `findActiveUserByEmail`. If null, run `verifyPassword(DUMMY_PASSWORD_HASH, password)` to consume time, then throw `InvalidCredentialsError`. If found, run `verifyPassword(user.passwordHash, password)`; on mismatch throw `InvalidCredentialsError`. On success: `withSystemAuth` → call `issueAccessToken(user)` + `generateRefreshToken(user.role)` + `createSession(tx, ...)` in a single transaction. Return `{ accessToken, refreshToken, tokenType: 'Bearer', expiresIn }`.
    - `refresh({ refreshToken })`: hash the input, call `findActiveSessionByHash(hash)`. If null → throw `InvalidCredentialsError` (same generic 401 — no enumeration of expired vs revoked vs unknown). On found: lookup the user via `findActiveUserByEmail` is wrong here — we have the userId on the session row; use a new `findUserById(userId)` repo helper. Then in a `withSystemAuth` transaction: `deleteSessionByHash(tx, oldHash)` + create new session + return tokens.
    - `logout({ refreshToken })`: hash the input, `withSystemAuth(tx => deleteSessionByHash(tx, hash))`. Always returns void (idempotent).
    - `InvalidCredentialsError` class — a discriminated error type the route handler maps to a 401 with the right slug.
  - [ ] Add `apps/api/src/services/auth.service.test.ts` covering: login success path returns shaped tokens; login with wrong password; login with unknown email runs argon2.verify on dummy (mocked, assert call count ≥ 1); refresh success rotates token (old hash deleted, new row exists); refresh with revoked/expired/unknown all throw `InvalidCredentialsError`; logout deletes session; logout with unknown token is a no-op.

- [ ] **Task 5 — Wire Fastify routes + token-expired error type (AC: #1, #2, #4, #5, #6)**
  - [ ] Create `apps/api/src/lib/auth-errors.ts` exporting `TokenExpiredError extends Error` (with `statusCode = 401` to integrate with `@fastify/sensible`'s convention) and `InvalidCredentialsError extends Error` (statusCode = 401).
  - [ ] Update `apps/api/src/middleware/auth.ts`: import `JWTExpired` from `jose/errors`. In the catch block of `jwtVerify`, branch: if `err instanceof JWTExpired` (use `err.name === 'JWTExpired'` for compat) → throw `new TokenExpiredError('Access token expired')`. Else keep the current `httpErrors.unauthorized('Invalid token')`.
  - [ ] Update `apps/api/src/middleware/error-handler.ts`: add a branch *before* the generic 401 mapping: `if (error instanceof TokenExpiredError) { problem = buildProblemDetail(401, 'Access token expired', instance); problem.type = '${PROBLEM_BASE}/token-expired'; … }` — or extend `STATUS_TO_SLUG` lookups to take an optional override. Cleanest: add a helper `buildProblemDetailWithSlug(status, slug, title, detail, instance)` and call it from this branch. Add a similar branch for `InvalidCredentialsError` that emits the existing `'authentication-required'` slug + `detail: 'Invalid email or password'`.
  - [ ] Create `apps/api/src/routes/auth.routes.ts`. Three routes registered under `/api/v1/auth/`:
    - `POST /login` — schema = `loginRequestSchema` body, `loginResponseSchema | problemDetailSchema` response. Calls `authService.login(body)`. Wrap `InvalidCredentialsError` → re-throw (handler converts to 401).
    - `POST /refresh` — schema = `refreshRequestSchema` body, same response.
    - `POST /logout` — schema = `logoutRequestSchema` body, 204 response. Always returns 204 even on unknown-token case.
    - All three use `fastifySchemaFromZod({ tags: ['auth'], summary, body, response })` so they appear in the OpenAPI doc at `/api/v1/docs`.
  - [ ] Register the routes in `apps/api/src/app.ts` after `registerDbHealthRoute(app)`. Confirm public-route allowlist already includes `/api/v1/auth/login` and `/api/v1/auth/refresh`; **add `/api/v1/auth/logout`** to `PUBLIC_ROUTES` in `auth.ts` so a client without a valid access token can still log out.
  - [ ] Add `apps/api/src/routes/auth.routes.test.ts` using `supertest` (already installed) and `buildApp()`:
    - Login with seeded test user → 200 with valid tokens; access token decodes and has role-specific exp.
    - Login with wrong password → 401, problem detail shape, no `email`/`password` field disclosure in `detail`, **and** request timing within ±200ms of the unknown-email case (loose timing assertion guards against regression of the dummy-hash check).
    - Login with unknown email → same 401 shape.
    - Login with empty email → 422 (validation).
    - Refresh with valid token → 200; old refresh hash no longer exists; new tokens differ from old.
    - Refresh with expired session row → 401.
    - Refresh after logout → 401.
    - Logout with valid token → 204.
    - Logout with unknown token → 204 (idempotent).

- [ ] **Task 6 — Local-dev seed script + docs (AC: enables AC1 verification)**
  - [ ] Create `packages/db/scripts/seed-test-users.ts`. Reads `DATABASE_URL`, hashes a literal default password (`'password123!'` — sentinel, dev-only), and upserts three users in tenant `'tenant-dev'`: `admin@cems.local` (ADMIN), `auditor@cems.local` (AUDITOR), `client@cems.local` (CLIENT, with `assignedStoreIds: ["store-001"]`). Idempotent (uses `prisma.user.upsert` keyed on `(tenantId, email)`).
  - [ ] Add `"db:seed:test-users": "tsx scripts/seed-test-users.ts"` to `packages/db/package.json` scripts. Use existing `tsx` dev dep.
  - [ ] Add a "Local auth setup" subsection in root `CLAUDE.md` (under Commands) showing the three default credentials + a `curl` example for `POST /api/v1/auth/login`. Make it explicit these are dev-only.
  - [ ] Do NOT seed in CI or any deployed environment — script must `process.exit(1)` if `NODE_ENV === 'production'`.

## Dev Notes

### Architecture & spec sources

- **JWT TTL matrix** (architecture.md Category 2 lines 207–212): Auditor 8h/7d, Admin 4h/1d, Client 4h/1d. Pinned in `packages/types/src/auth.ts` constants.
- **Refresh token storage** (architecture.md line 214): "Refresh tokens stored in `user_sessions` table (hashed). Rotation on every refresh. Revocation via `sessions` table delete." → SHA-256 hex hash; rotation-on-use; delete-on-logout.
- **No Azure AD MVP** (architecture.md line 234): email/password only. SSO is post-MVP.
- **NFR-S1** (TLS 1.2+) — covered by Azure App Service / SWA. Out of scope for code.
- **NFR-S2** (encryption at rest) — Azure SQL TDE. Out of scope.
- **NFR-S3** (RLS at DB layer cannot be bypassed at app layer) — auth flow is the **one explicitly sanctioned exception**; documented in Dev Notes below and in `system-auth-context.ts` JSDoc.
- **NFR-S6** (sessions expire after configurable inactivity) — partially satisfied by hard expiry on access (4–8h) and refresh (1–7d) tokens. Inactivity-based revocation deferred.
- **RFC 7807** (architecture.md Category 3 lines 244–254) — every 401/422 response is `application/problem+json`.

### Library versions (pin these)

- `argon2@^0.41.1` (Node 22-compatible; native bindings to libargon2 — pnpm builds the native module on install)
- `jose@^5.9.6` — already installed via Story 0.4
- `zod@^3.24.1` — already installed
- `@fastify/sensible@^6.0.3` — already installed; provides `httpErrors.unauthorized`
- `supertest@^7.0.0` — already devDep in `apps/api`
- Node 22 native `node:crypto.randomBytes`, `createHash` — no new deps needed for refresh token gen / hashing

### What 0-3 / 0-4 already shipped (do NOT rebuild)

- `User` model with `tenantId`, `email`, `name`, `role`, `passwordHash`, `assignedStoreIds`, `createdAt`, `updatedAt`. Composite unique on `(tenantId, email)`. **No `status` field yet** — Story 1.3 adds it.
- `UserSession` model with `tenantId`, `userId`, `refreshTokenHash` (unique-indexed), `expiresAt`, `revokedAt`, `createdAt`. Foreign key to user with `onDelete: NoAction`.
- `apps/api/src/middleware/auth.ts` — JWT preHandler hook validating HS256 + `jwtClaimsSchema` and populating `request.rlsContext`. Already includes 5s `clockTolerance`. Story 1.1 extends this for the `JWTExpired` branch only.
- `PUBLIC_ROUTES` set in `auth.ts` — already includes `/api/v1/auth/login` and `/api/v1/auth/refresh`. Story 1.1 adds `/auth/logout`.
- `apps/api/src/middleware/error-handler.ts` — RFC 7807 with `STATUS_TO_SLUG` map. Story 1.1 adds the `TokenExpiredError` and `InvalidCredentialsError` branches and slug overrides.
- `apps/api/src/middleware/rls-request.ts` — `request.withRls(fn)` wraps `withRlsTransaction`. Auth routes do NOT use `request.withRls` because there is no `request.rlsContext` on public routes — they use the new `withSystemAuth` helper instead.
- `packages/db/src/middleware/rls.ts` — `withRlsTransaction(prisma, ctx, fn)` exported. Story 1.1 builds `withSystemAuth` on top of this.
- `cems/no-tenant-raw-prisma` ESLint rule — only blocks `$queryRaw`/`$executeRaw` on the bare client. Normal `prisma.user.findFirst({...})` calls outside `withRlsTransaction` are NOT flagged but DO bypass RLS — see RLS section below.

### The system-auth RLS bypass (load-bearing design decision)

**Problem.** At login, the API receives an email but does not yet know the tenant. Looking up the user by email requires querying `users` without a tenant predicate. RLS evaluates `fn_tenant_predicate(@tenant_id)` against `SESSION_CONTEXT('tenant_id')`; with empty session context the predicate fails and 0 rows are visible.

**Solution.** Use `SYSTEM_AUTH_CONTEXT = { tenantId: '__auth_system__', userId: '__auth_system__', role: 'ADMIN', assignedStoreIds: [] }` — a sentinel context whose `role: 'ADMIN'` triggers the OR-clause in `security.fn_tenant_predicate`:

```sql
WHERE @tenant_id = SESSION_CONTEXT('tenant_id')
   OR UPPER(SESSION_CONTEXT('user_role')) = 'ADMIN'
```

When `user_role = ADMIN`, the predicate returns 1 regardless of `@tenant_id`, making all rows visible. This is the SAME mechanism that allows admin users to query across tenants in the admin console. Auth lookups exploit it intentionally.

**Constraints / safety**:
- Use `withSystemAuth` ONLY in `apps/api/src/services/auth.service.ts`, `apps/api/src/repositories/user.repo.ts`, `apps/api/src/repositories/user-session.repo.ts`. Add a code comment in each call site explaining why.
- After the user is resolved, every subsequent operation in the same request must use the user's *actual* tenant context (i.e., do NOT keep the system context alive past the user-resolution step).
- The sentinel `tenantId: '__auth_system__'` must NOT be a real tenant id. Add a `CHECK constraint` (out of scope for 1.1, deferred-work) or a runtime invariant that `'__auth_system__'` cannot be inserted as a real tenant id.
- Future hardening (deferred): introduce a new SESSION_CONTEXT key `is_system_auth` so role=ADMIN no longer doubles as the auth-flow gate. Tracked in deferred-work.

### No-enumeration discipline (timing + payload)

Both unknown-email and wrong-password must:
1. Return **identical** JSON: `{ type: '…/authentication-required', title: 'Unauthorized', status: 401, detail: 'Invalid email or password', instance }`.
2. Take **comparable** time. Implementation: when user not found, run `verifyPassword(DUMMY_PASSWORD_HASH, suppliedPassword)` and discard the result before throwing. Argon2 verify takes ~30ms on the configured cost; the dummy-hash branch matches that timing within an order of magnitude.
3. NOT log the email at WARN/ERROR level (or do so under a redaction-aware logger key). Pino redaction in `apps/api/src/lib/logger.ts` already redacts `request.body.password`; extend it if needed but don't rely on that — never include the raw email in error log lines.

### Refresh token rotation atomicity

Login + refresh must be atomic to prevent split-brain (old token deleted but new token not yet inserted, leaving the user without any valid session if the connection drops). Use a single `withSystemAuth` transaction:

```ts
await withSystemAuth(async (tx) => {
  await tx.userSession.deleteMany({ where: { refreshTokenHash: oldHash } })
  await tx.userSession.create({ data: { tenantId, userId, refreshTokenHash: newHash, expiresAt } })
})
```

The `withRlsTransaction` helper already wraps the operation in `prisma.$transaction(async (tx) => …)` — this is interactive-tx semantics with one connection, so SESSION_CONTEXT propagates correctly.

### Argon2 vs bcrypt

Architecture.md does not pin a password hash algorithm. **Choosing Argon2id** because:
- OWASP 2024 password-storage cheat sheet recommends Argon2id as first choice.
- Cost-tunable: memoryCost: 19456 (19 MiB), timeCost: 2, parallelism: 1 — meets OWASP minimum recommendation 2024 and runs under 50ms on a modern Linux server (acceptable login latency).
- `argon2` npm package (the `argon2`, not `argon2-browser`) has stable Node native bindings, supports Node 22.
- Per-hash salt + cost embedded in the encoded hash; no separate columns needed in the User schema (existing `passwordHash NVARCHAR` column suffices).

**Trade-off:** native module — pnpm has to build on install. CI uses Node 22 + Ubuntu, supported. Local dev on Apple Silicon also supported. If a future deployment target lacks a C toolchain, switch to `@node-rs/argon2` (pure-Rust binary) without API surface changes.

### MVP single-tenant assumption

The User table allows the same `(tenantId, email)` only once but permits the same email across two tenants. For MVP single-tenant ("Star Energy"), email is effectively globally unique. Login uses `findFirst({ where: { email } })` and returns 401 if multiple rows match (paranoia — should never happen).

A future multi-tenant story will need a tenant resolver (e.g., subdomain `auditor.{tenant}.cems.starenergy.ca` → `tenantId`). Story 1.1 does not pre-build that — leave as a deferred-work item documented in this story's Completion Notes.

### File List (anticipated)

**Modify:**
- `apps/api/package.json` — add `argon2` dep
- `apps/api/src/middleware/auth.ts` — branch on `JWTExpired`; import claims schema from `@cems/types`
- `apps/api/src/middleware/error-handler.ts` — `TokenExpiredError` + `InvalidCredentialsError` branches with custom slug
- `apps/api/src/app.ts` — register auth routes
- `packages/db/package.json` — add `db:seed:test-users` script
- `packages/types/src/index.ts` — re-export `auth.js`
- `pnpm-lock.yaml` (regenerated)
- `CLAUDE.md` — local auth setup section

**Create:**
- `apps/api/src/lib/passwords.ts` + `passwords.test.ts`
- `apps/api/src/lib/tokens.ts` + `tokens.test.ts`
- `apps/api/src/lib/system-auth-context.ts`
- `apps/api/src/lib/auth-errors.ts`
- `apps/api/src/repositories/user.repo.ts` + `user.repo.test.ts`
- `apps/api/src/repositories/user-session.repo.ts` + `user-session.repo.test.ts`
- `apps/api/src/services/auth.service.ts` + `auth.service.test.ts`
- `apps/api/src/routes/auth.routes.ts` + `auth.routes.test.ts`
- `packages/types/src/auth.ts`
- `packages/db/scripts/seed-test-users.ts`

### Anti-pattern prevention (LLM disaster avoidance)

- **DO NOT** add a UI login form, token-storage code, or Authorization-header interceptor in any SPA. That is Story 1.2's scope.
- **DO NOT** use `request.withRls(fn)` inside auth routes — they have no `request.rlsContext`. Use `withSystemAuth(fn)` instead.
- **DO NOT** keep the `SYSTEM_AUTH_CONTEXT` alive past the user-resolution step. Each subsequent request uses the real user's RLS context (set by the auth middleware on the response from `/login` going forward).
- **DO NOT** include the email in 401 error responses or WARN-level logs. Generic `'Invalid email or password'` only.
- **DO NOT** skip the dummy-argon2-verify when the user is not found. Timing leaks user existence — defeats AC2.
- **DO NOT** persist the raw refresh token anywhere — only the SHA-256 hex hash in `user_sessions.refresh_token_hash`.
- **DO NOT** issue tokens with hardcoded TTLs. Always look up `ACCESS_TOKEN_TTL_BY_ROLE[user.role]` from `@cems/types` to keep the matrix single-sourced.
- **DO NOT** add rate-limiting / lockout in this story (deferred to a future security-hardening story).
- **DO NOT** broaden `PUBLIC_ROUTES` beyond `/auth/login`, `/auth/refresh`, `/auth/logout`. New entries require an architecture review note (per the existing comment in `auth.ts` line 13).
- **DO NOT** modify the `cems/no-tenant-raw-prisma` ESLint rule. The rule does not flag normal Prisma model calls — `prisma.user.findFirst` etc. work fine inside `withSystemAuth`.
- **DO NOT** seed users in CI. Seed script must check `NODE_ENV !== 'production'` and refuse otherwise.
- **DO NOT** drop the `(tenantId, email)` composite-unique constraint or change to email-only. That requires a migration + multi-tenant resolver design — out of scope.

### Project Structure Notes

**Alignment with unified project structure:**
- `apps/api/src/routes/auth.routes.ts` — matches existing routes/ pattern (e.g., `db-health.ts`).
- `apps/api/src/services/auth.service.ts` — first occupant of the previously-empty `services/` directory; matches architecture.md line 382 layer description.
- `apps/api/src/repositories/user.repo.ts`, `user-session.repo.ts` — matches existing `audit-log.repo.ts` pattern.
- `apps/api/src/lib/passwords.ts`, `tokens.ts`, `system-auth-context.ts`, `auth-errors.ts` — `lib/` is the right home (utilities; not domain-bound). Mirrors `azure-blob.ts`, `calc-service-client.ts`, `redis.ts`, `schema.ts`, `logger.ts`.
- `packages/types/src/auth.ts` — schemas + constants; mirrors existing `audit.ts`, `user.ts`, `api.ts`.

**Detected variances:**
- The User table has no `status` field. Story 1.3 will add one. Until then, all users are implicitly ACTIVE; the `findActiveUserByEmail` helper is forward-compatible (no extra clause needed today).
- The User table allows the same email in two tenants. MVP is single-tenant so this is fine; cross-tenant ambiguity is a 401-deny case in `auth.service.login`. A future multi-tenant story will need a tenant resolver (subdomain or header-based).

### Previous-story intelligence

**0-1 Turborepo scaffold (done):** `prisma`, `bullmq`, `@azure/storage-blob`, `puppeteer`, `resend`, `jose`, `@fastify/swagger` declared but unused. 1.1 lights up `jose` (already partially used in 0-4 auth middleware) for the issuance side and consumes existing zod / fastify-sensible.

**0-3 DB schema & RLS (done):** User + UserSession tables landed; tenant predicates configured. The OR-ADMIN clause in `fn_tenant_predicate` is the load-bearing escape hatch for system-auth. Deferred-work item from 0-3: "ADMIN bypass allows typo'd tenant_id on INSERT — later story adds tenants reference table with FK check." 1.1 inherits this risk; mitigated by the `__auth_system__` sentinel only being used in code we control.

**0-4 API foundation (done):** JWT verify hook + RFC 7807 + RLS request middleware + public-route allowlist all wired. 1.1 builds on top — does NOT rebuild any of this. Several deferred items from 0-4 review map directly to 1.1 sub-tasks:
- "JWT validation does not enforce iss/aud — Story 1.1 token issuance scope." → Add `iss: 'cems'` and `aud: 'cems-api'` to issued tokens; update `jwtVerify` options to enforce.
- "Authorization header could arrive as `string[]`; `.replace` would throw. Story 1.1." → Defensive cast: `if (Array.isArray(authHeader)) authHeader = authHeader[0]`.
- "`assignedStoreIds` has no `.max(N)` cap — large arrays could exceed MSSQL `session_context` 256KB limit. Story 1.1." → Add `.max(500)` to `accessTokenClaimsSchema.assignedStoreIds`.
- "OPTIONS preflight on protected routes returns 401 (no CORS). Story 1.1 CORS wiring." → **Deferred to Story 1.2** (front-end integration). Out of scope here.

**Apply the four 0-4 deferred items** as part of Task 5's auth-middleware update where they're a one-liner. Track in Completion Notes.

**0-5 calc-service (done):** Irrelevant.

**0-6 CI/CD (done):** Irrelevant. CI will pick up new tests automatically.

**0-7 design tokens & UI library (done):** Irrelevant.

**0-8 a11y & testing infrastructure (review):** SPA Vitest + axe + Playwright wired. 1.1 ships no SPA changes, so 0-8 gates are not exercised here. **Story 1.2 will exercise them** when the login form lands.

### Git intelligence

- Branch naming: `story/1-1-email-password-login-and-jwt-issuance` (mirror precedent).
- Conventional-commit prefix: `feat(api): email/password auth — login/refresh/logout (Story 1.1)`.
- No `Co-Authored-By: Claude` trailer (project convention).
- Commit body should call out the four 0-4 deferred items addressed inline.
- Squashed merge into `main` per existing PR pattern.

### References

- [docs/bmad/_bmad-output/planning-artifacts/epics.md#Story-1.1](../planning-artifacts/epics.md) — ACs lines 517–547
- [docs/bmad/_bmad-output/planning-artifacts/architecture.md#Category-2-Authentication-Security](../planning-artifacts/architecture.md) — JWT TTL matrix, RLS bypass mechanism
- [docs/bmad/_bmad-output/planning-artifacts/architecture.md#Category-3-API-Communication](../planning-artifacts/architecture.md) — RFC 7807 shape
- [docs/bmad/_bmad-output/planning-artifacts/prd.md#User-Access-Management](../planning-artifacts/prd.md) — FR38–FR42
- [docs/bmad/_bmad-output/planning-artifacts/prd.md#Security](../planning-artifacts/prd.md) — NFR-S1 to NFR-S7
- [packages/db/prisma/schema.prisma](../../../../packages/db/prisma/schema.prisma) — User + UserSession models
- [packages/db/prisma/migrations/20260424164958_add_rls_and_checks/migration.sql](../../../../packages/db/prisma/migrations/20260424164958_add_rls_and_checks/migration.sql) — `fn_tenant_predicate` with OR-ADMIN clause
- [apps/api/src/middleware/auth.ts](../../../../apps/api/src/middleware/auth.ts) — current JWT verify hook to extend
- [apps/api/src/middleware/error-handler.ts](../../../../apps/api/src/middleware/error-handler.ts) — RFC 7807 + slug map to extend
- [docs/bmad/_bmad-output/implementation-artifacts/deferred-work.md](./deferred-work.md) — 0-4 deferred items (iss/aud, header[], storeIds cap)
- [OWASP Argon2id parameters (2024)](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html#argon2id) — memory 19 MiB, time 2, parallelism 1 minimums

## Dev Agent Record

### Agent Model Used

claude-opus-4-7[1m]

### Debug Log References

_(populated by dev-story execution)_

### Completion Notes List

_(populated by dev-story execution)_

### File List

_(populated by dev-story execution)_

## Change Log

| Date | Change | Author |
|---|---|---|
| 2026-05-07 | Initial story file created from epic 1.1 | create-story (claude-opus-4-7[1m]) |
