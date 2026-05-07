# Story 1.3: Admin User Management — Auditor Accounts

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an Admin,
I want to create, edit, and deactivate Auditor accounts,
so that field technicians can be onboarded and offboarded without engineering involvement.

**Source:** [docs/bmad/_bmad-output/planning-artifacts/epics.md#Story-1.3](../planning-artifacts/epics.md) lines 581–605. Covers FR39 (admin manages auditor accounts).

**Scope clarification:** This story ships:
- Schema: new `users.status` column (`ACTIVE` / `INACTIVE`) with CHECK constraint and a new `password_set_tokens` table for the one-shot welcome-email password-set link, both with RLS policies.
- API: `POST/GET/PATCH /api/v1/users` (admin-only, AUDITOR-role only — Story 1.4 adds CLIENT support); `GET /api/v1/auth/password-set/validate` + `POST /api/v1/auth/password-set` (public).
- Login service: rejects `INACTIVE` users with the same generic 401 (no enumeration).
- Session revocation: setting `status: INACTIVE` deletes every `user_sessions` row for that user.
- Audit log: every `USER_CREATED` / `USER_UPDATED` / `USER_DEACTIVATED` event written to `audit_log`.
- Email: enqueues a job to the existing `cems-email-notification-low` BullMQ queue (the worker is still a stub from 0.4 — real Resend integration lands in Story 5.5; this story produces the right payload).
- admin-app: minimal users-management UI — list page + create form + status-toggle action. Wired with TanStack Query.
- audit-app: a `/set-password` page that consumes the welcome-email link.
- Cleanup: deletes the synthetic `apps/api/src/routes/_test.routes.ts` from 1.2 (real ADMIN routes now exercise `requireRole`).

Out of scope:
- CLIENT account creation + store assignment — Story 1.4.
- Real Resend send (template rendering, idempotency, retry) — Story 5.5.
- Password complexity policy (the spec doesn't pin one; this story enforces only `min(12).max(256)` at the schema layer; complexity rules deferred).
- Email change re-verification (admin patching a user's email currently takes effect immediately; if the spec later demands a confirmation flow, that's a follow-up).
- Bulk user import / CSV upload.

## Acceptance Criteria

1. **AC1 — `POST /api/v1/users` with `role: AUDITOR` creates the user, enqueues a welcome email, and the account is `ACTIVE`.** Body: `{ email, name, role: 'AUDITOR' }`. Server: validates Zod, generates a random initial `passwordHash` (argon2id of 32 random bytes — user can never log in with it), inserts the user row inside `request.withRls(...)` (admin's tenant via RLS), inserts a `password_set_tokens` row (token = base64url(64 random bytes), `tokenHash` = sha256-hex, `expiresAt` = now+24h), enqueues `cems-email-notification-low` with payload `{ to: user.email, templateId: 'auditor-welcome', variables: { name, link, expiresHours: 24 }, tenantId, auditId: undefined }` where `link = '${VITE_AUDIT_APP_URL}/set-password?token=<plaintext>'` (the API resolves the URL from `AUDIT_APP_URL` env), appends an `audit_log` row `USER_CREATED`, returns `201` with the user shape (no `passwordHash`, no token). Idempotency: `(tenantId, email)` is uniquely constrained → second create with same email → `409 Conflict` RFC 7807 with `detail: 'User with this email already exists'`.

2. **AC2 — `PATCH /api/v1/users/:id` with `name` or `email` updates the row, takes effect immediately.** Body: `{ name?, email? }` (status handled in AC3). Server: validates Zod, looks up user via `request.withRls(...)` (404 if not in tenant), updates the row, appends `audit_log` row `USER_UPDATED` with `payload: { changedFields: [...] }`, returns `200` with the updated user. Email change is permitted (no re-verification flow at MVP) but enforces the existing `(tenantId, email)` unique constraint → `409 Conflict` if the new email collides.

3. **AC3 — `PATCH /api/v1/users/:id` with `status: 'INACTIVE'` deactivates the user; active sessions are revoked; the user cannot log in.** Body: `{ status: 'INACTIVE' }` (or `'ACTIVE'` to re-activate). Server: in a single `withRls` transaction → updates `users.status`, **deletes every `user_sessions` row where `userId = :id`**, appends `audit_log` row `USER_DEACTIVATED` (or `USER_REACTIVATED`). Then any subsequent call to `POST /api/v1/auth/login` for this user returns the **same generic 401** as wrong-password (the login service treats `INACTIVE` as if the user did not exist — no enumeration of "deactivated" vs "wrong password"). The login service ALSO continues to run argon2 verify against the dummy hash on the deactivated branch to preserve timing parity.

4. **AC4 — `GET /api/v1/users?role=AUDITOR` returns only the admin's tenant's auditor accounts (RLS).** Query: `?role=AUDITOR` (required for this story; CLIENT support arrives in 1.4). Optional `?status=ACTIVE|INACTIVE`. Server: `request.withRls(...)` so Azure SQL RLS scopes results to the admin's tenant — verified by an integration-style test that an admin in tenant-A cannot see tenant-B users. Response: `{ users: User[], total }` where each user is `{ id, email, name, role, status, createdAt, updatedAt }`. **No `passwordHash`, no assignedStoreIds at MVP** (that's a CLIENT-only field surfaced in 1.4). Pagination is NOT implemented in 1.3 (cap at 200 results; `total` is the count of returned rows; revisit when the queue table lands in Story 7.1).

5. **AC5 — Welcome email link resolves to a working password-set flow.** `GET /api/v1/auth/password-set/validate?token=<plaintext>` (public): returns `200 { valid: true, email }` if the token's sha256 hash exists, has `usedAt: null`, and `expiresAt > now()`; returns `404` (NOT 401, NOT a problem with `detail` echoing the email) otherwise. `POST /api/v1/auth/password-set` (public): body `{ token, password }` — validates token, validates `password.min(12).max(256)`, hashes via argon2id, updates `users.passwordHash`, marks `password_set_tokens.usedAt = now()`, returns `204`. Token is one-shot — replay returns `404`. The audit-app `/set-password` page consumes both endpoints and renders an error if the token is invalid/expired.

6. **AC6 — `requireRole([UserRole.ADMIN])` is wired on every `/api/v1/users/*` route.** Cross-role calls (AUDITOR / CLIENT JWTs) hit the existing 1.2 RFC 7807 403 path. **The synthetic `apps/api/src/routes/_test.routes.ts` from 1.2 is deleted** — real ADMIN routes now exercise `requireRole`. The `/api/v1/_test/admin-only` endpoint must 404 after this story.

## Tasks / Subtasks

- [ ] **Task 1 — Schema migration: `users.status` + `password_set_tokens` (AC: #1, #3, #5)**
  - [ ] Update `packages/db/prisma/schema.prisma`:
    - Add to `User`: `status String @default("ACTIVE") @map("status") @db.NVarChar(20)`. Add the back-relation `passwordSetTokens PasswordSetToken[]` so cascade delete (when implemented later) is type-safe.
    - Add new model `PasswordSetToken` with fields `id` (cuid), `tenantId`, `userId`, `tokenHash` (`@unique`), `expiresAt`, `usedAt` (nullable), `createdAt` (default now). Indexes on `tenantId` and `userId`. `@@map("password_set_tokens")`. Foreign key to user with `onDelete: Cascade` so deleting a user cascades to outstanding tokens.
    - Add an index on `User`: `@@index([tenantId, status], map: "idx_users_tenant_status")` for AC4's filtering performance.
  - [ ] Generate the migration: `pnpm --filter @cems/db db:migrate:dev --name "add_user_status_and_password_set_tokens"` (per the existing migration naming convention from 0-3).
  - [ ] Hand-edit the generated SQL to add:
    - `ALTER TABLE dbo.users ADD CONSTRAINT ck_users_status CHECK (status IN ('ACTIVE', 'INACTIVE'))` — matches the `ck_users_role` pattern from `20260424164958_add_rls_and_checks/migration.sql`.
    - RLS security policy on `password_set_tokens` (filter + block predicates on `tenant_id`) — mirrors the existing `users_policy` / `user_sessions_policy` patterns. Use the existing `security.fn_tenant_predicate` (no new function needed).
  - [ ] Regenerate the Prisma client (`pnpm --filter @cems/db db:generate`) so apps see the updated `User` and the new `PasswordSetToken` types.

- [ ] **Task 2 — Repositories: `users.repo.ts` + `password-set-token.repo.ts` (AC: #1–#5)**
  - [ ] Extend `apps/api/src/repositories/user.repo.ts`:
    - Add `status` to `AuthUser` (string union `'ACTIVE' | 'INACTIVE'`) and update `selectUserBy` + `mapRow`.
    - Update existing call sites in `auth.service.ts` to handle `status` (see Task 5).
    - Add `createUser(tx, { tenantId, email, name, role, passwordHash, status }): Promise<User>` — the admin-create path. Returns the user shape (no passwordHash).
    - Add `updateUser(tx, id, { name?, email?, status? }): Promise<User>` — partial PATCH. Throws Prisma's `P2002` (unique violation) → caller maps to 409.
    - Add `listUsersByRole(tx, { role, status?, limit }): Promise<{ users: User[]; total: number }>` — for AC4. Limit defaults to 200 (no pagination yet).
    - Add `findUserByIdInTenant(tx, id): Promise<User | null>` — RLS-scoped lookup (returns null if user is in another tenant).
  - [ ] Create `apps/api/src/repositories/password-set-token.repo.ts`:
    - `createPasswordSetToken(tx, { tenantId, userId, tokenHash, expiresAt })` → inserts row.
    - `findActiveToken(tx, tokenHash): Promise<{ userId, tenantId, email } | null>` — joins on user to fetch email, filters `usedAt: null` and `expiresAt: { gt: new Date() }`. **Joins via `user.email` so the validate endpoint can return the email without a second query.**
    - `markTokenUsed(tx, tokenHash): Promise<{ count: number }>` — `updateMany` setting `usedAt: now()`. Returns count for idempotency check.
    - `deleteSessionsByUserId(tx, userId): Promise<{ count: number }>` — used by the deactivation path; lives in `user-session.repo.ts` actually (Task 3).
  - [ ] Tests for both repos using the `vi.fn` + fake-tx pattern from existing repo tests.

- [ ] **Task 3 — Services: `user.service.ts` + extend `auth.service.ts` (AC: #1–#5)**
  - [ ] Create `apps/api/src/services/user.service.ts`:
    - `createAuditor({ tenantId, email, name, ctx })` — generates random initial passwordHash via argon2id of `crypto.randomBytes(32)`, calls `withRls(tx ⇒ … )` to insert user + password_set_token, enqueues email job, appends audit_log `USER_CREATED`. Returns the created user. Catches Prisma P2002 → throws `UserEmailConflictError extends Error { statusCode = 409 }` (new in `lib/auth-errors.ts`).
    - `updateUser({ id, patch, ctx })` — `withRls(tx ⇒ updateUser + audit_log USER_UPDATED with changed fields)`. If `patch.status === 'INACTIVE'` (or `'ACTIVE'`), append `USER_DEACTIVATED` / `USER_REACTIVATED` event instead. **If `INACTIVE`, also call `deleteSessionsByUserId(tx, id)` in the same transaction.**
    - `listUsersByRole({ role, status, ctx })` — straight delegate to repo.
  - [ ] Extend `auth.service.ts`:
    - In `login(input)`: after fetching the user, **if `user.status !== 'ACTIVE'`** → `await verifyPassword(getDummyPasswordHash(), input.password)` → throw `InvalidCredentialsError`. Same generic 401 + same timing as wrong-password.
  - [ ] Extend `user-session.repo.ts`:
    - `deleteSessionsByUserId(tx, userId): Promise<{ count: number }>` — `deleteMany({ where: { userId } })`. Used by the deactivation path.
  - [ ] Add `apps/api/src/services/password-set.service.ts`:
    - `validateToken(tokenPlain): Promise<{ valid: true; email: string } | null>` — hashes via `hashRefreshToken` (rename to a more general `sha256Hex` helper, see Task 5), looks up via `findActiveToken`, returns the email or null.
    - `setPassword({ tokenPlain, newPassword }): Promise<void>` — atomic `withSystemAuth(tx => …)`: lookup token, update user.passwordHash, mark token used. Throws a generic `InvalidCredentialsError` on any failure (unknown / used / expired token) — same uniform 401 shape.
  - [ ] Tests with mocked repos for all three services. Cover: createAuditor success + duplicate-email, updateUser status-INACTIVE deletes sessions in same tx, INACTIVE login attempt returns InvalidCredentialsError + still calls dummy verify, password-set happy path + replay (used token) returns null.

- [ ] **Task 4 — Routes: `users.routes.ts` + `password-set.routes.ts` (AC: #1–#6)**
  - [ ] Create `apps/api/src/routes/users.routes.ts`:
    - `POST /api/v1/users` — `preHandler: requireRole([UserRole.ADMIN])`. Body Zod: `{ email: z.string().email(), name: z.string().min(1).max(128), role: z.literal('AUDITOR') }`. Catches `UserEmailConflictError` → 409 RFC 7807 with `detail: 'User with this email already exists'`. Returns 201.
    - `PATCH /api/v1/users/:id` — `preHandler: requireRole([UserRole.ADMIN])`. Params `{ id: z.string().min(1) }`. Body: `{ name?: ..., email?: ..., status?: z.enum(['ACTIVE','INACTIVE']) }` — at least one field required (`.refine(...)`). 404 if user not in tenant. 409 on email collision.
    - `GET /api/v1/users` — `preHandler: requireRole([UserRole.ADMIN])`. Query: `{ role: z.literal('AUDITOR'), status: z.enum(['ACTIVE','INACTIVE']).optional() }`. Returns `{ users: [], total }`.
    - All three routes use `fastifySchemaFromZod` so they appear in OpenAPI docs at `/api/v1/docs`.
  - [ ] Create `apps/api/src/routes/password-set.routes.ts`:
    - `GET /api/v1/auth/password-set/validate` — public, query `{ token: z.string().min(1) }`. Returns `200 { valid: true, email }` or `404`.
    - `POST /api/v1/auth/password-set` — public, body `{ token: z.string().min(1), password: z.string().min(12).max(256) }`. Returns `204` on success, `400` on validation error, generic `InvalidCredentialsError` (mapped to 401) on bad token.
    - **Add both paths to `PUBLIC_ROUTES` in `auth.ts`.**
  - [ ] Add `password_set_token` payload schema constants to `packages/types/src/auth.ts`: `passwordSetValidateResponseSchema`, `passwordSetRequestSchema`, plus the `User` Zod shape used by the admin endpoints (`adminUserSchema`, `createUserRequestSchema`, `updateUserRequestSchema`, `listUsersResponseSchema`).
  - [ ] Register new route blocks in `apps/api/src/app.ts`. Maintain registration order: `registerDbHealthRoute` → `registerAuthRoutes` → `registerMeRoutes` → `registerUsersRoutes` (NEW) → `registerPasswordSetRoutes` (NEW) → test routes (gated).
  - [ ] **Delete `apps/api/src/routes/_test.routes.ts` and `_test.routes.test.ts`**. Remove the gated registration in `app.ts`. Update the 1.2 story file's anti-pattern callout (1.3 obsoletes the synthetic route — note in this story's Completion Notes).

- [ ] **Task 5 — Cross-cutting plumbing (AC: #1, #5, #6)**
  - [ ] Rename `hashRefreshToken` → `sha256Hex` in `apps/api/src/lib/tokens.ts` (it's just sha256 hex of any string; the password-set token reuses it). Keep a `hashRefreshToken` re-export for backward compatibility within the file for one PR, or do a clean rename + sweep with `replace_all` (preferred). Update auth.service + tokens.test references.
  - [ ] Add `lib/url.ts` with a single helper `getAuditAppUrl(): string` reading `process.env.AUDIT_APP_URL` (default `'http://localhost:5173'`). Used by `user.service.createAuditor` to build the welcome-email link. **Note env var name** — server-side, NOT `VITE_AUDIT_APP_URL` (Vite's prefix is for browser bundling). Add `AUDIT_APP_URL` to `.env.example` and CLAUDE.md.
  - [ ] Update `packages/types/src/auth.ts` to add `UserStatus` type union (`'ACTIVE' | 'INACTIVE'`), and a Zod schema for the admin-side User shape returned by the list/get endpoints.
  - [ ] Add `UserEmailConflictError` to `apps/api/src/lib/auth-errors.ts` with `statusCode = 409`.
  - [ ] Update `apps/api/src/middleware/error-handler.ts` to recognize `UserEmailConflictError` and emit RFC 7807 409 with `detail: 'User with this email already exists'`.
  - [ ] Update the existing `seed-test-users.ts` script to set `status: 'ACTIVE'` explicitly on all three seeded users (so it survives the new check constraint).
  - [ ] Tests: `user.service.test.ts`, `password-set.service.test.ts`, `users.routes.test.ts` (POST 201/409 + PATCH 200/404/409 + GET 200 + role-mismatch 403), `password-set.routes.test.ts` (validate 200/404 + set 204/401), `error-handler.test.ts` extension for the new 409 branch.

- [ ] **Task 6 — admin-app: minimal users management UI (AC: #1, #2, #3, #4)**
  - [ ] Add `apps/admin-app/src/features/users/users-api.ts` — TanStack Query hooks calling the existing `apiFetch`:
    - `useUsersList({ role, status })` → `GET /api/v1/users?role=…&status=…`.
    - `useCreateUser()` → POST.
    - `useUpdateUser()` → PATCH.
    - On mutation success: `queryClient.invalidateQueries(['users'])`.
  - [ ] Add `apps/admin-app/src/features/users/UsersPage.tsx`:
    - Renders a `@cems/ui` `Table` of users with columns: Name, Email, Status, Created. A "Status" toggle button per row (Activate / Deactivate). A status-filter select (`All / ACTIVE / INACTIVE`).
    - "New auditor" button opens a `Dialog` with a 2-field form (name, email) → `useCreateUser()` → on success, closes dialog + shows a `Toast` "User created — welcome email queued."
    - Loading and error states via TanStack Query primitives. Empty state: "No auditor accounts yet."
    - Page route: `/users` (only accessible after RequireAuth).
  - [ ] Update `apps/admin-app/src/App.tsx` — add the new route. The existing `Home` component stays at `/`; `<Route path="/users" element={<UsersPage />} />` joins the protected tree under `RequireAuth`.
  - [ ] Add `UsersPage.test.tsx` — at minimum: renders without axe violations; empty-list state shows; create-form opens on button click. (Full mutation testing can lean on the API tests — UI tests focus on render correctness.)

- [ ] **Task 7 — audit-app: `/set-password` page (AC: #5)**
  - [ ] Add `apps/audit-app/src/features/auth/SetPasswordPage.tsx`:
    - Reads `?token=…` from the URL via `useSearchParams`.
    - On mount: calls `GET /api/v1/auth/password-set/validate?token=…` (via `apiFetch`, no Authorization header). Renders one of three states: `loading` (skeleton), `invalid` ("This password-set link is invalid or has expired. Contact your administrator."), `ready` (form with one password field — could add a confirm field but MVP just one).
    - On submit: `POST /api/v1/auth/password-set` with `{ token, password }`. On 204: redirect to `/login` with a success toast hint via `?welcome=true` query param. On error: render via `aria-live`.
    - Password complexity: only `min(12)` enforced client-side mirror.
  - [ ] Update `apps/audit-app/src/App.tsx` — add `/set-password` as a PUBLIC route (sibling of `/login`, not wrapped in `RequireAuth`). Update PUBLIC_ROUTES set with this path? No — that's API-side; SPA-side this is just a router route.
  - [ ] Add `SetPasswordPage.test.tsx` — covers loading, invalid, success.

- [ ] **Task 8 — Audit-log entries + integration sanity (AC: #1, #2, #3)**
  - [ ] Wire `appendLogFromRequest` calls in `user.service.ts` for `USER_CREATED`, `USER_UPDATED`, `USER_DEACTIVATED`, `USER_REACTIVATED`. Payloads:
    - `USER_CREATED`: `{ targetUserId, role, email }`.
    - `USER_UPDATED`: `{ targetUserId, changedFields: ['email','name'] }` (filter out `status`).
    - `USER_DEACTIVATED` / `USER_REACTIVATED`: `{ targetUserId, sessionsRevoked }`.
    - All carry `actorUserId` + `actorRole` + `tenantId` from the request's rlsContext (via the existing `appendLogFromRequest` helper).
  - [ ] Sanity test: in `user.service.test.ts`, assert `audit_log.create` is called with the expected `eventType` for each happy path.
  - [ ] Update `apps/api/src/repositories/audit-log.repo.ts` if a new `eventType` enum is exposed there — currently it's a plain string, so no change needed.

## Dev Notes

### Schema decisions

- **`users.status`** as a string with check-constraint, NOT a Prisma enum, because:
  - Prisma 7 + MSSQL doesn't support DB-level enums uniformly; the existing `role` column uses the same string + check-constraint pattern (see `20260424164958_add_rls_and_checks/migration.sql` line 23–25). Mirroring this is consistent.
  - Adding new statuses later (e.g., `'PENDING'`, `'LOCKED'`) is a one-line check-constraint update.
- **`password_set_tokens` is a new table**, not a column on `users`. Reasons: tokens have an expiry, can be invalidated independently, audit-trail value (you want to know how many resends occurred), and supports future "admin-resends-link" UX without a schema change.
- **One-shot tokens** via `usedAt timestamp NULL` (vs deleting the row): preserves an audit trail. Combined with the `expiresAt` filter at lookup time, a used token returns `null` from `findActiveToken`.

### Email job — produce-only, consumer is still a stub

`apps/api/src/jobs/email-notification.job.ts` is currently a STUB worker (per the file's own comment: "Real implementation in Story 5.5"). Story 1.3 only **enqueues** jobs — it does NOT activate the worker's Resend integration. The job payload schema (`emailNotificationPayloadSchema`) already supports `templateId` + `variables`; the new `auditor-welcome` template is a string identifier the 5.5 story will resolve. **Do not extend the worker** in this story; doing so couples 1.3 to 5.5's deliverable scope.

A test must verify that `createAuditor` calls `emailNotificationQueue.add('auditor-welcome', payload)` with the correct shape — but does NOT need to verify the email was actually sent. Mock the queue.

### Login service: INACTIVE handling

The login service currently rejects unknown emails with `InvalidCredentialsError` and runs an argon2 dummy-verify to maintain timing parity (Story 1.1). For 1.3, **add the same parity-preserving branch for `status: INACTIVE`**:

```ts
if (!user || user.status !== 'ACTIVE') {
  await verifyPassword(await getDummyPasswordHash(), input.password)
  throw new InvalidCredentialsError()
}
```

Three failure modes — unknown email, INACTIVE user, wrong password — collapse to ONE response shape AND comparable timing. AC3's "user cannot log in" is the visible behaviour; the no-enumeration discipline from 1.1 extends to it.

### Session revocation atomicity

`PATCH /api/v1/users/:id` with `status: 'INACTIVE'` MUST update the user row AND delete every `user_sessions` row for that user in the SAME `withRls` transaction. If the DB connection drops between updates and deletes, the user could be `INACTIVE` but their refresh tokens still valid → on next API call from the deactivated user, the auth hook validates the JWT (still valid for up to 8h depending on TTL) AND the refresh path still works (sessions row undeleted). So:

```ts
await req.withRls(async (tx) => {
  await updateUser(tx, id, { status: 'INACTIVE' })
  const { count } = await deleteSessionsByUserId(tx, id)
  await appendLog(tx, { tenantId: ctx.tenantId, eventType: 'USER_DEACTIVATED',
    actorUserId: ctx.userId, actorRole: ctx.role,
    payload: { targetUserId: id, sessionsRevoked: count } })
})
```

The auth hook's JWT verify is **stateless** — it does NOT consult `user_sessions` on every request. So a deactivated user's existing access token continues to work until it expires (max 8h for AUDITOR). **This is documented behaviour, not a bug.** Mitigations:
- The `/me` route in 1.2 already does a fresh `findActiveUserById` lookup on every call → reading `status` there and 401-ing on `INACTIVE` is a 1.3 enhancement that closes the gap.
- The `/auth/refresh` route 401s because the session row is gone → no new tokens after deactivation.

**Story 1.3 should also add the `/me` status check** so the SPAs get the deactivated signal within one cycle of the next request rather than waiting for the access token to naturally expire. Implementation: add `if (user.status !== 'ACTIVE') return 401` to `me.routes.ts`. Keep the SPA's behaviour (clear-session on 401) unchanged from 1.2.

### Welcome-email link URL

The link in the welcome email is `${AUDIT_APP_URL}/set-password?token=<plaintext>`. Important details:
- **Server-side env var**: `AUDIT_APP_URL` (no `VITE_` prefix). Vite's `VITE_*` prefix is for browser-bundled SPA env vars; the API runs on Node.js and reads its own env directly.
- **Default**: `http://localhost:5173` for dev parity with Story 1.2's `VITE_AUDIT_APP_URL`.
- **Token in URL query**: yes, this is leakier than POST body, but unavoidable for an email-based bootstrap. Mitigations: token is one-shot + expiring, so a leaked URL is short-window. Future hardening: signed URL with HMAC.
- **The `set-password` PAGE lives in audit-app** — the URL never bounces through admin-app or client-portal. Auditors are the only role being managed in 1.3. Story 1.4 extends this with a client-portal `/set-password` page; the email template's `link` will dispatch to the right surface based on `user.role`.

### `hashRefreshToken` rename → `sha256Hex`

The existing `hashRefreshToken(token)` in `apps/api/src/lib/tokens.ts` is just a thin wrapper around `crypto.createHash('sha256').update(token).digest('hex')`. The password-set token storage uses the **same** sha256 pattern. Rename the helper to `sha256Hex` so its name reflects what it actually does. Sweep `auth.service.ts`, `tokens.test.ts` for call-site updates.

This is a small but intentional refactor — clean naming makes the password-set token's hashing strategy obvious to future readers.

### `_test.routes.ts` deletion checklist

Delete:
- `apps/api/src/routes/_test.routes.ts`
- `apps/api/src/routes/_test.routes.test.ts`
- The `if (process.env['NODE_ENV'] !== 'production') registerTestRoutes(app)` block in `apps/api/src/app.ts`
- The `import { registerTestRoutes } from './routes/_test.routes.js'` line in `app.ts`

Keep:
- The `requireRole` factory itself — it's now exercised by the real `/users/*` routes.
- The Story 1.2 file's mention of `_test.routes.ts` — leave the historical context. Add a one-line "Closed by Story 1.3" annotation in this story's Completion Notes.

### Library version pins (May 2026)

- All deps already installed via 1.1/1.2 — `argon2`, `jose`, `bullmq`, `@cems/db`, etc. **No new npm dependencies for 1.3.**
- The Prisma migration is the only schema-touching change. Run via the existing `db:migrate:dev` script.

### Anti-pattern prevention (LLM disaster avoidance)

- **DO NOT** activate the email worker's Resend integration. That's Story 5.5. 1.3 enqueues the job; the stub worker logs and marks delivered.
- **DO NOT** use the `@cems/types` user shape (which has no `status`) to type admin endpoints. Add a new `adminUserSchema` with `status` in 1.3's types update.
- **DO NOT** mutate `users.passwordHash` directly except via `argon2.hash(...)` of a fresh plaintext or a random secret. Never `null` it.
- **DO NOT** add user creation through the public `/auth/*` routes. Account creation is admin-only in MVP.
- **DO NOT** allow self-deactivation. The PATCH route should refuse if `:id === request.rlsContext.userId` AND `body.status === 'INACTIVE'` → 400 RFC 7807 with `detail: 'Admins cannot deactivate themselves'`.
- **DO NOT** echo the email in 401 / 404 / 409 problem details. Generic copy only — the no-enumeration discipline from 1.1 still applies.
- **DO NOT** delete the `audit_log` rows when a user is deactivated. The trail is permanent (the audit_log table has a deny-all UPDATE/DELETE security policy from 0-3).
- **DO NOT** broaden `PUBLIC_ROUTES` beyond `/auth/login`, `/auth/refresh`, `/auth/logout`, `/auth/password-set`, `/auth/password-set/validate`. Each addition needs an explicit architecture-review note.
- **DO NOT** keep the synthetic `_test.routes.ts` "just in case." Real ADMIN routes now exercise `requireRole` — the synthetic route is a maintenance liability.
- **DO NOT** introduce a "magic admin email" that bypasses the role check. Even seed-script users honour `requireRole`.
- **DO NOT** treat `PATCH email` as a no-op when the value matches the existing email. Prisma's update will succeed regardless; the audit-log entry should still record the no-op (helps detect malicious admin enumeration).
- **DO NOT** add bulk-import / CSV upload. Out of scope.
- **DO NOT** make the `/users` GET return `passwordHash` even by accident. The repo's `select` clause must explicitly exclude it.

### File List (anticipated)

**Modify:**
- `packages/db/prisma/schema.prisma` — User.status + new PasswordSetToken model
- `apps/api/package.json` — no change (no new deps)
- `apps/api/src/app.ts` — register new routes, remove _test routes
- `apps/api/src/middleware/auth.ts` — add `/auth/password-set/*` to PUBLIC_ROUTES
- `apps/api/src/middleware/error-handler.ts` — UserEmailConflictError branch
- `apps/api/src/lib/auth-errors.ts` — add UserEmailConflictError
- `apps/api/src/lib/tokens.ts` — rename hashRefreshToken → sha256Hex (+ re-export shim)
- `apps/api/src/lib/tokens.test.ts` — call-site updates
- `apps/api/src/services/auth.service.ts` — INACTIVE branch in login + dummy verify
- `apps/api/src/services/auth.service.test.ts` — INACTIVE login test
- `apps/api/src/repositories/user.repo.ts` — status field + createUser/updateUser/listUsersByRole/findUserByIdInTenant
- `apps/api/src/repositories/user.repo.test.ts` — extended tests
- `apps/api/src/repositories/user-session.repo.ts` — deleteSessionsByUserId
- `apps/api/src/repositories/user-session.repo.test.ts` — extended tests
- `apps/api/src/routes/me.routes.ts` — 401 on INACTIVE user
- `apps/api/src/routes/me.routes.test.ts` — INACTIVE 401 case
- `apps/api/src/middleware/error-handler.test.ts` — 409 case
- `packages/types/src/auth.ts` — adminUserSchema, createUserRequestSchema, updateUserRequestSchema, listUsersResponseSchema, passwordSetValidateResponseSchema, passwordSetRequestSchema, UserStatus type
- `packages/db/scripts/seed-test-users.ts` — explicit status: 'ACTIVE'
- `apps/admin-app/src/App.tsx` — add /users route
- `apps/audit-app/src/App.tsx` — add /set-password public route
- `CLAUDE.md` — AUDIT_APP_URL env var note + admin user management section
- `pnpm-lock.yaml` — regenerated (Prisma client regen)
- `docs/bmad/_bmad-output/implementation-artifacts/sprint-status.yaml` — 1-3 → ready-for-dev → in-progress → review

**Create:**
- `packages/db/prisma/migrations/<timestamp>_add_user_status_and_password_set_tokens/migration.sql`
- `apps/api/src/lib/url.ts` — getAuditAppUrl helper
- `apps/api/src/services/user.service.ts` + `user.service.test.ts`
- `apps/api/src/services/password-set.service.ts` + `password-set.service.test.ts`
- `apps/api/src/repositories/password-set-token.repo.ts` + `password-set-token.repo.test.ts`
- `apps/api/src/routes/users.routes.ts` + `users.routes.test.ts`
- `apps/api/src/routes/password-set.routes.ts` + `password-set.routes.test.ts`
- `apps/admin-app/src/features/users/users-api.ts`
- `apps/admin-app/src/features/users/UsersPage.tsx` + `UsersPage.test.tsx`
- `apps/audit-app/src/features/auth/SetPasswordPage.tsx` + `SetPasswordPage.test.tsx`

**Delete:**
- `apps/api/src/routes/_test.routes.ts`
- `apps/api/src/routes/_test.routes.test.ts`

### Project Structure Notes

**Alignment with unified project structure:**
- `apps/api/src/routes/users.routes.ts` matches the `auth.routes.ts` / `me.routes.ts` precedent.
- `apps/api/src/services/user.service.ts` joins the `auth.service.ts` precedent in the previously-empty `services/` directory.
- `apps/api/src/repositories/password-set-token.repo.ts` matches `user-session.repo.ts` naming (singular noun + `.repo.ts`).
- `apps/admin-app/src/features/users/` — first occupant of admin-app's feature-module directory; matches architecture.md line 360–373's frontend feature layout.

**Detected variances:**
- The migration is the **first one to hand-edit a Prisma-generated SQL file** (to add the check constraint + RLS policy). Prisma's migration files are `.sql` — fully editable. Document the hand-edit clearly in a SQL comment so future developers don't `prisma migrate reset` it accidentally.
- The `hashRefreshToken` → `sha256Hex` rename is a **breaking change to a non-public symbol** (auth.service is the only call-site). Do it cleanly via `replace_all`; no compat shim.
- `users.routes.ts` returns a NEW user shape that excludes `passwordHash` — distinct from the internal `AuthUser` type that includes it. Use the `adminUserSchema` from `@cems/types` to enforce the boundary.

### Previous-story intelligence

**1.1 (review):** `auth.service.login` already handles unknown email with the dummy-verify pattern. 1.3 extends this to also handle `INACTIVE` users — same code path, just one more branch. The `getDummyPasswordHash()` helper is reused.

**1.2 (review):** `requireRole([UserRole.ADMIN])` factory + `RoleNotPermittedError` are wired and tested. 1.3 attaches them to real routes for the first time and **deletes the synthetic `_test.routes.ts`**.

**0.4:** `appendLogFromRequest` exists for audit-log writes. 1.3 calls it for every CREATE/UPDATE/DEACTIVATE. The audit-log table has a deny-all UPDATE/DELETE security policy — append-only at the DB layer.

**0.3 deferred items:** "ADMIN bypass allows typo'd tenant_id on INSERT — later story adds tenants reference table with FK check." 1.3 does NOT address this; admin user creation still trusts the rlsContext's tenantId. Tracked in deferred-work; revisit when multi-tenant becomes real.

**0.4 deferred item NOW addressed in 1.3:** "Worker `failed` handler logs but does NOT write to `audit_log` — failures missing from tamper-evident trail." The new email enqueue path doesn't make this WORSE — the stub worker still doesn't log to audit_log. The audit-log entries 1.3 adds are at the **enqueue** boundary, not the consume boundary. When 5.5 wires real Resend, it should add `EMAIL_SENT` / `EMAIL_FAILED` audit-log entries on the consume side.

### Git intelligence

- Branch naming: `story/1-3-admin-user-management-auditor-accounts`.
- Conventional commit prefix: `feat(api): admin auditor account management + password-set flow (Story 1.3)`.
- Two commits expected: (1) `docs: create Story 1.3 context file …` (this file) (2) `feat: … (Story 1.3)` (the implementation).
- The migration commit may be split out if review complexity demands it: `feat(db): add user.status + password_set_tokens (Story 1.3)` followed by `feat(api): … (Story 1.3)`. **Single commit is preferred** unless review feedback requests the split.

### References

- [docs/bmad/_bmad-output/planning-artifacts/epics.md#Story-1.3](../planning-artifacts/epics.md) — ACs lines 581–605
- [docs/bmad/_bmad-output/planning-artifacts/architecture.md#Category-2-Authentication-Security](../planning-artifacts/architecture.md) — RLS via SESSION_CONTEXT
- [docs/bmad/_bmad-output/planning-artifacts/prd.md#User-Access-Management](../planning-artifacts/prd.md) — FR39 + FR41
- [packages/db/prisma/schema.prisma](../../../../packages/db/prisma/schema.prisma) — User + UserSession models to extend
- [packages/db/prisma/migrations/20260424164958_add_rls_and_checks/migration.sql](../../../../packages/db/prisma/migrations/20260424164958_add_rls_and_checks/migration.sql) — check-constraint + RLS-policy patterns to mirror
- [apps/api/src/services/auth.service.ts](../../../../apps/api/src/services/auth.service.ts) — login service to extend with INACTIVE branch
- [apps/api/src/middleware/role-guard.ts](../../../../apps/api/src/middleware/role-guard.ts) — requireRole factory now used on real routes
- [apps/api/src/jobs/email-notification.job.ts](../../../../apps/api/src/jobs/email-notification.job.ts) — stub worker; produce-only side wired in 1.3
- [docs/bmad/_bmad-output/implementation-artifacts/1-2-role-based-surface-access-and-route-guards.md](./1-2-role-based-surface-access-and-route-guards.md) — handoff source

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
| 2026-05-07 | Initial story file created from epic 1.3 | create-story (claude-opus-4-7[1m]) |
