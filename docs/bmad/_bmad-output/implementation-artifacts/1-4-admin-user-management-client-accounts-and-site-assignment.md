# Story 1.4: Admin User Management — Client Accounts & Site Assignment

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an Admin,
I want to create Client accounts and assign them to specific store locations,
so that clients can log in and see only the data for their sites — no other client's data is ever visible.

**Source:** [docs/bmad/_bmad-output/planning-artifacts/epics.md#Story-1.4](../planning-artifacts/epics.md) lines 607–629. Covers FR40 (admin manages client accounts) and exercises FR42 (row-level data isolation per assigned stores) end-to-end. Closes Epic 1.

**Scope clarification:** This story widens the user-management surface from 1.3 (auditor-only) to **also handle CLIENT** accounts with `assignedStoreIds`. Concretely:

- API: widen `POST/PATCH /api/v1/users` to accept `role: CLIENT` + `assignedStoreIds: string[]`. Rename `createAuditor` → `createUser` (role-agnostic). Welcome-email link is role-aware (Auditor → audit-app, Client → client-portal). New `assignedStoreIds` updates re-issue **on next API call** because the JWT's claims are stale until token refresh — document this trade-off + add a `/me` recheck.
- Audits: add a **stub** `GET /api/v1/audits` that returns the RLS-scoped audit list for the calling user. This is the minimum needed to satisfy AC2 end-to-end. Real audit-feature endpoints ship in Epic 2 (and replace the stub).
- client-portal: ship a `/set-password` page (mirror of the audit-app one from 1.3) so the welcome-email link works for Clients.
- admin-app: extend `UsersPage` to switch between AUDITOR and CLIENT views via a role tab. Add a `New client` form with a free-text comma-separated `assignedStoreIds` input — interim UX until Story 2.1 / 6.1 ship the real store-picker.

Out of scope:
- Real store-picker UX in admin-app — Story 6.1 (store reference data management).
- Real `GET /api/v1/audits` feature implementation — Epic 2 + Story 7.1 (admin queue) wires this for production. The 1.4 stub is a minimal RLS-aware list returning whatever rows the caller's RLS predicate allows.
- Per-store "click to drill into audit" UX in client-portal — Story 10.x.
- Bulk client onboarding — out of MVP.

## Acceptance Criteria

1. **AC1 — `POST /api/v1/users` with `role: CLIENT` creates the user, persists `assignedStoreIds`, and enqueues a Client-specific welcome email.** Body: `{ email, name, role: 'CLIENT', assignedStoreIds: string[] }`. `assignedStoreIds` may be empty (admin can assign later via PATCH) but is required as a field. Server stores the array as JSON in `users.assigned_store_ids` (existing column). The welcome-email link is `${CLIENT_PORTAL_URL}/set-password?token=…` (NOT `${AUDIT_APP_URL}` — role-aware via `SURFACE_BY_ROLE`). Audit log: `USER_CREATED` event payload includes `role: 'CLIENT'` and `assignedStoreIdsCount`. AUDITOR creates from 1.3 continue to work — the only change is widening the input enum, not narrowing it.

2. **AC2 — Client login + `GET /api/v1/audits` returns ONLY rows for the client's assigned stores; unassigned-store rows return 404.** A new (minimal) `GET /api/v1/audits` route is registered, guarded by the auth hook (any role). Implementation: `request.withRls(tx => tx.audit.findMany({ take: 50, select: { id, storeId, status, createdAt, updatedAt } }))`. Azure SQL's existing `security.fn_audits_filter(@tenant_id, @store_id)` from 0-3 enforces the store-level filter when `SESSION_CONTEXT('user_role') = 'CLIENT'` — Client sees only audits where `store_id ∈ JSON_PARSE(assigned_store_ids)`. Test: with two seeded audits (one in an assigned store, one in another), the Client GET returns only the assigned-store row. Attempting to fetch the unassigned audit by id (a future `GET /api/v1/audits/:id` from Epic 2) returns 404 because RLS applies to single-row reads too — out of 1.4 scope to wire, but documented.

3. **AC3 — `PATCH /api/v1/users/:id` updates `assignedStoreIds`; the change takes effect on the Client's next `withRls` call (within the same access-token lifetime, the JWT carries stale storeIds — see Dev Notes for the tradeoff).** Patch body: `{ name?, email?, status?, assignedStoreIds? }` — at least one field required (already enforced by 1.3's refine). Persists immediately. **Caveat:** the access token is signed and the SPA holds it in memory (Story 1.2); the RLS predicate uses `SESSION_CONTEXT('assigned_store_ids')` set by `withRlsTransaction` from `request.rlsContext`, which the auth hook **populates from the JWT**. So a Client whose assignments were just changed continues to see the OLD list until their access token refreshes (max ~4h). The `/me` endpoint is updated to read **the live DB row** for `assignedStoreIds` so the client-portal can detect the drift and trigger a refresh. Audit log: `USER_UPDATED` payload includes `assignedStoreIdsChanged: boolean` when the field is touched.

4. **AC4 — Deactivating a Client revokes sessions; subsequent login returns 401.** Already implemented in 1.3 — the deactivation path is role-agnostic. AC4 is satisfied by the existing logic + a CLIENT-role test case that confirms login and refresh both 401 after deactivation.

## Tasks / Subtasks

- [ ] **Task 1 — Widen the create-user input + rename `createAuditor` (AC: #1)**
  - [ ] In `packages/types/src/auth.ts`, replace `createUserRequestSchema`'s `role: z.literal(UserRole.AUDITOR)` with `role: z.enum([UserRole.AUDITOR, UserRole.CLIENT])`. Add `assignedStoreIds: z.array(z.string().min(1)).max(ASSIGNED_STORE_IDS_MAX).default([])`. **Add a Zod refine: `assignedStoreIds` must be empty when `role === 'AUDITOR'`** (auditors don't have store-scoped access; documented in Dev Notes).
  - [ ] In `packages/types/src/auth.ts`, extend `updateUserRequestSchema` with `assignedStoreIds: z.array(z.string().min(1)).max(ASSIGNED_STORE_IDS_MAX).optional()`. The existing refine ("at least one field") already accommodates the new optional field.
  - [ ] In `apps/api/src/services/user.service.ts`, rename `createAuditor` → `createUser`. Change signature to accept `CreateUserRequest` (role + optional assignedStoreIds). Pass `assignedStoreIds` through to the repo's `createUser`. The welcome-email link branch on role: `SURFACE_BY_ROLE[body.role]` → resolve URL via a new `getSurfaceUrl(surface)` helper in `apps/api/src/lib/url.ts`. Audit-log `USER_CREATED` payload now includes `role` (already there) + `assignedStoreIdsCount: assignedStoreIds.length`.
  - [ ] In `apps/api/src/lib/url.ts`, add `getSurfaceUrl(surface: SurfaceCode): string` that maps `'audit'` → `getAuditAppUrl()`, `'admin'` → `getAdminAppUrl()`, `'client'` → `getClientPortalUrl()`. Used by user.service when composing the welcome-email link.
  - [ ] In `apps/api/src/services/user.service.ts`, also update `updateUser` to pass `assignedStoreIds` through to the repo's `updateUser` patch when present. Audit-log `USER_UPDATED` payload now includes `assignedStoreIdsChanged: boolean` (true iff the field was touched in this PATCH).
  - [ ] Update `user.service.test.ts`: add CLIENT-role create cases (with + without assignedStoreIds), update existing AUDITOR test name from `createAuditor` to `createUser`. Add a PATCH-assignedStoreIds case asserting the `assignedStoreIdsChanged` audit-log payload bit.

- [ ] **Task 2 — Widen the routes (AC: #1, #3)**
  - [ ] In `apps/api/src/routes/users.routes.ts`:
    - Update the route handler that called `userService.createAuditor` to call `userService.createUser` (now role-agnostic).
    - Update `listQuerySchema` (`role: z.literal(UserRole.AUDITOR)`) to `role: z.enum([UserRole.AUDITOR, UserRole.CLIENT])`. The list endpoint already passes `role` through.
    - PATCH route forwards `assignedStoreIds` from the validated body — no handler change beyond the schema widening.
  - [ ] Update `users.routes.test.ts`:
    - Add a "201 creates a CLIENT" test case asserting the role + assignedStoreIds round-trip.
    - Add a "422 when AUDITOR is sent with non-empty assignedStoreIds" case proving the cross-field refine.
    - Add a "200 updates assignedStoreIds via PATCH" case.

- [ ] **Task 3 — Stub `GET /api/v1/audits` (AC: #2)**
  - [ ] Create `apps/api/src/repositories/audit.repo.ts` with `listAuditsForCaller(tx, { take = 50 }): Promise<AuditListItem[]>`. Selects only `{ id, storeId, status, createdAt, updatedAt }` from the Audit Prisma model. Returns the rows as-is — RLS does the filtering at the DB layer.
  - [ ] Create `apps/api/src/routes/audits.routes.ts` with a single `GET /api/v1/audits` (any authenticated role). Schema: response `{ audits: AuditListItem[], total: number }`. Calls `request.withRls(tx => listAuditsForCaller(tx))`. **No write routes; no `:id` route — those land in Epic 2 / Story 7.1.**
  - [ ] Add `auditListItemSchema` and `listAuditsResponseSchema` to `packages/types/src/audit.ts` (extend, do NOT replace, the existing exports — Epic 2 will widen these).
  - [ ] Register `registerAuditsRoutes` in `apps/api/src/app.ts` after `registerUsersRoutes`.
  - [ ] Add `apps/api/src/routes/audits.routes.test.ts`:
    - 200 with empty array when no audits exist.
    - 200 returns the seeded audits (mock the repo).
    - 401 when no Authorization header.
    - **No role check** — every authenticated role can list (RLS does the per-tenant + per-store filtering).
  - [ ] Add `apps/api/src/repositories/audit.repo.test.ts` with a mock-tx test verifying `findMany` arg shape.

- [ ] **Task 4 — `/me` returns LIVE assignedStoreIds (AC: #3 caveat resolution)**
  - [ ] Update `apps/api/src/routes/me.routes.ts`: the response builder reads `user.assignedStoreIds` from the freshly-fetched DB row (it already does — the repo's `findActiveUserById` returns the parsed `string[]`). **No code change** is strictly needed — but add a Dev Notes-aligned test asserting that `/me`'s `assignedStoreIds` reflects the LATEST DB state, NOT the JWT's stale claim. Use a mocked repo that returns a different-from-claim value and assert the response.
  - [ ] Document in the route's JSDoc that `/me`'s `assignedStoreIds` is the source-of-truth for the SPA — "the JWT's `assignedStoreIds` claim is the SECURITY GATE; this field is the UX TRUTH."

- [ ] **Task 5 — client-portal `/set-password` page (AC: #1 client-side)**
  - [ ] Copy `apps/audit-app/src/features/auth/SetPasswordPage.tsx` and `.test.tsx` to `apps/client-portal/src/features/auth/`. Files are byte-identical (the page reads `?token=` and POSTs to `/api/v1/auth/password-set` — surface-agnostic).
  - [ ] In `apps/client-portal/src/App.tsx`, add `<Route path="/set-password" element={<SetPasswordPage />} />` as a sibling of `/login` (public). Update import.
  - [ ] Confirm the test file's describe block reads `client-portal` not `audit-app` — sweep with sed on copy.

- [ ] **Task 6 — admin-app: role-aware UsersPage (AC: #1, #3)**
  - [ ] Update `apps/admin-app/src/features/users/UsersPage.tsx`:
    - Add a role tab: `Auditors` / `Clients`. State: `roleFilter: 'AUDITOR' | 'CLIENT'`. The list query passes the selected role. The status filter remains separate.
    - The existing "New auditor" button becomes role-aware: `New {roleFilter === 'CLIENT' ? 'client' : 'auditor'}`.
    - The Dialog form gains a conditional `assignedStoreIds` field (only when `roleFilter === 'CLIENT'`): a free-text input that comma-splits + trims into a `string[]`. Helper text: "Store IDs (comma-separated). Future stories will replace this with a store picker."
    - The table for Clients gains an `Assigned stores` column showing `assignedStoreIds.length` as a count + a tooltip with the comma-joined IDs.
  - [ ] Update `apps/admin-app/src/features/users/users-api.ts`:
    - The hooks already accept `CreateUserRequest` / `UpdateUserRequest` — schema widening means CLIENT + assignedStoreIds flow through automatically. Add an explicit `useUsersList({ role: 'AUDITOR' | 'CLIENT', status?: UserStatus })` overload (already string-typed; just widen the type signature).
    - List response schema needs to include `assignedStoreIds` for CLIENT rows. **This requires extending `adminUserSchema` in `@cems/types/auth.ts`** to add `assignedStoreIds: z.array(z.string()).default([])`. The repo's `listUsersByRole` select clause must include `assignedStoreIds` and parse it (mirror the existing AuthUser parsing).
  - [ ] Update `UsersPage.test.tsx` — the existing 3 tests stay; add one CLIENT-role render test asserting the assigned-stores column is present + populated for a seeded CLIENT row.

- [ ] **Task 7 — Audit-log + Dev Notes wire-up (AC: #1, #3)**
  - [ ] Already covered in Task 1's user.service edits (`assignedStoreIdsCount` on USER_CREATED, `assignedStoreIdsChanged` on USER_UPDATED). Confirm the test assertions land.

- [ ] **Task 8 — Final sweep + docs**
  - [ ] Run `pnpm turbo run lint type-check test`. Fix any breakage.
  - [ ] Run `pnpm --filter audit-app exec playwright test` + admin-app + client-portal — regenerate baselines if the home / login / set-password pages drift.
  - [ ] Update CLAUDE.md "Admin User Management" section: mention CLIENT support + the JWT-staleness caveat with the `/me` recheck mitigation.
  - [ ] Update story file with checkboxes + Dev Agent Record. Flip sprint-status `1-4 → review`. Final commit.

## Dev Notes

### The `createAuditor → createUser` rename

The 1.3 service was named `createAuditor` because the schema literal was `z.literal(UserRole.AUDITOR)`. 1.4 widens the role enum, so the function name becomes misleading. **Rename it.** No deprecation alias — internal symbol with two call sites (the route handler + the test). Sweep cleanly via `replace_all`.

### Welcome-email link routing per role

Auditors set their password on `${AUDIT_APP_URL}/set-password`; Clients on `${CLIENT_PORTAL_URL}/set-password`. The welcome-email job's `variables.link` must be computed per role:

```ts
const surface = SURFACE_BY_ROLE[body.role]
const link = `${getSurfaceUrl(surface)}/set-password?token=${tokenPlain}`
```

Admin users do not currently get welcome-email password-set flows (1.3 doesn't expose `POST /api/v1/users` for ADMIN role; 1.4 keeps that restriction — admins bootstrap via the seed script).

### `assignedStoreIds` cross-field validation

The Zod refine "AUDITOR must have empty assignedStoreIds" prevents a class of admin-error bugs (the form should grey-out the field for AUDITOR; the schema is the backstop). When `role === 'CLIENT'`, the field can be empty (admin assigns stores later via PATCH). Empty CLIENT means **no audit data visible** — that's intentional, never an error.

### The JWT-staleness tradeoff for `assignedStoreIds`

Architecture spec: every API call's RLS context is populated from the JWT (Story 0.4 + 1.2). The JWT is signed with `assignedStoreIds` baked in as a claim and lives up to ~4h before refresh. Therefore:

- An admin who changes a Client's `assignedStoreIds` via PATCH → the change persists immediately in the DB.
- The Client's RLS predicate on the next API call still uses the OLD list (from the JWT) until their access token expires/refreshes.
- A worst-case window of 4h (Client's TTL) where a recently-revoked store still appears + a recently-added store doesn't.

**Mitigations + design decisions:**

1. **`/me` reads from the LIVE DB row**, not from the JWT. SPAs can compare `me.assignedStoreIds` against the JWT's claims and prompt the user to re-login (or trigger a silent refresh). The 1.2 refresh flow re-issues the JWT with the latest claims. This is the **UX correction** path.
2. **Documented as accepted at MVP.** Force-refresh on every PATCH would require pushing a refresh trigger to all the Client's connected SPAs (websocket / SSE) — out of MVP scope.
3. **Security note:** the staleness goes BOTH ways. A removed store stays accessible for up to 4h. This is acceptable because (a) audit data is read-only for Clients, (b) the Client previously had legitimate access, (c) a 4h read-window is bounded. If product ever flags this as unacceptable, the fix is shorter Client TTLs (currently 4h) OR mandatory re-login on assignment changes.
4. **Future hardening:** add a "session generation" claim to the JWT + a column on `users.session_generation`; bumping the column on assignment change invalidates all existing JWTs. Tracked in deferred-work.

### `GET /api/v1/audits` stub — minimum to test AC2

Story 1.4 needs SOMETHING to validate that RLS scopes audit reads to assigned stores. The proper feature lives in Epic 2 (DRAFT creation) + Story 7.1 (admin queue). 1.4 ships the **minimum stub**:

- `GET /api/v1/audits` — returns `{ audits, total }` where each item is `{ id, storeId, status, createdAt, updatedAt }`. No filtering, no pagination params, hard-coded `take: 50`.
- The route is auth-gated only — no `requireRole`. Every role can list. RLS filters the rows:
  - ADMIN sees all audits in their tenant (`fn_audits_filter` second clause: `OR user_role = 'ADMIN'`).
  - AUDITOR sees all audits in their tenant.
  - CLIENT sees only audits whose `store_id` is in `OPENJSON(SESSION_CONTEXT('assigned_store_ids'))`.
- Tests use mocked tx (matching the repo-test pattern). Real RLS verification is an integration test, deferred to a CI integration suite (Story 0-3 has an `rls.integration.test.ts` placeholder).

When Epic 2 Story 2.2 ships POST /audits + the full GET, this stub is REPLACED in-place. The route signature stays the same (the response shape `{ audits, total }` is forward-compatible).

### `audits` repo response shape

Don't reach for the full Audit row shape in 1.4 — the calc fields (`baseline_kwh`, `ecm_savings_estimate`, etc.) are added in Epic 8 and would be brittle to declare here. Just `{ id, storeId, status, createdAt, updatedAt }` is enough. Add the `auditListItemSchema` to `packages/types/src/audit.ts`; future stories extend it via `.extend(...)` rather than replacing.

### `assignedStoreIds` plumbing across layers

Every layer that touches `assignedStoreIds` needs the same array:

1. **DB**: `users.assigned_store_ids NVARCHAR(MAX)` — JSON-encoded array. Already in schema.
2. **Repo**: `selectUserBy` already includes `assigned_store_ids`. Parsed in `mapRow` (defensive against malformed JSON / non-string entries — already handled).
3. **JWT issuance**: `tokens.ts.issueAccessToken` already passes `user.assignedStoreIds` into the claims. No change.
4. **JWT verify + RLS context**: `auth.ts` already reads `assignedStoreIds` from claims and freezes it into `request.rlsContext`. No change.
5. **RLS apply**: `rls.ts.applySessionContext` already JSON-stringifies `ctx.assignedStoreIds` and sets `SESSION_CONTEXT('assigned_store_ids')`. No change.
6. **SQL predicate**: `security.fn_audits_filter` already does `OPENJSON(SESSION_CONTEXT('assigned_store_ids'))`. No change.
7. **NEW** — Admin write path: `userService.createUser/updateUser` accepts `assignedStoreIds` in the patch and writes via Prisma's User.assignedStoreIds (auto-`JSON.stringify` via the repo's pattern).
8. **NEW** — `/me` response: surface the live row's parsed array.

So the wiring is **mostly already done**. 1.4 just opens up the input surface and verifies end-to-end.

### Anti-pattern prevention (LLM disaster avoidance)

- **DO NOT** assign Auditors to stores. The schema technically allows non-empty `assignedStoreIds` on AUDITOR rows, but `fn_audits_filter` ignores it for non-CLIENT roles. The Zod refine prevents accidental data.
- **DO NOT** widen `requireRole([UserRole.ADMIN])` on `/api/v1/users/*`. CLIENT role widening is on the BODY enum, not on the route guard.
- **DO NOT** invent a new `assigned_stores` table. The existing JSON column carries the data; complexity isn't justified at MVP.
- **DO NOT** force-refresh JWTs on every `assignedStoreIds` PATCH. Staleness is documented + accepted.
- **DO NOT** delete the audit-app's SetPasswordPage when adding the client-portal one. They serve different surfaces; the welcome-email link picks the right one based on role.
- **DO NOT** reach for store-picker UX in `UsersPage`. Free-text comma-separated is the interim. Story 6.1 + 2.1 build the real picker.
- **DO NOT** add pagination or filtering to the `GET /api/v1/audits` stub. Out of scope; Epic 2 / Story 7.1 do it properly.
- **DO NOT** put `assignedStoreIds` in error responses (debug logs OK; problem-detail bodies NOT). Same no-enumeration discipline as 1.1.
- **DO NOT** allow ADMIN role through `POST /api/v1/users`. Admins bootstrap via the seed script. The Zod enum `[AUDITOR, CLIENT]` enforces this — do NOT widen it.
- **DO NOT** expose `passwordHash` on the `/users` list response. The repo's select clause excludes it; verify in tests.
- **DO NOT** modify the existing JWT shape to bake `session_generation`. That's deferred-work.

### Library version pins

No new dependencies. Everything is built on 1.1/1.2/1.3 plumbing.

### File List (anticipated)

**Modify:**
- `packages/types/src/auth.ts` — widen create/update schemas; extend `adminUserSchema` with `assignedStoreIds`
- `packages/types/src/audit.ts` — add `auditListItemSchema`, `listAuditsResponseSchema`
- `apps/api/src/lib/url.ts` — add `getSurfaceUrl(surface)`
- `apps/api/src/services/user.service.ts` — rename `createAuditor → createUser`, role-aware welcome link, `assignedStoreIdsCount`/`assignedStoreIdsChanged` audit-log fields
- `apps/api/src/services/user.service.test.ts` — CLIENT cases, rename, PATCH-assignedStoreIds case
- `apps/api/src/repositories/user.repo.ts` — `listUsersByRole` select includes `assignedStoreIds` + parse; createUser passes through `assignedStoreIds`
- `apps/api/src/repositories/user.repo.test.ts` — new shape
- `apps/api/src/routes/users.routes.ts` — `userService.createUser` call; widen `listQuerySchema` role enum
- `apps/api/src/routes/users.routes.test.ts` — CLIENT 201, AUDITOR-with-storeIds 422, PATCH assignedStoreIds 200
- `apps/api/src/routes/me.routes.ts` — JSDoc note (no behavioural change)
- `apps/api/src/routes/me.routes.test.ts` — assertion that response storeIds reflect live DB
- `apps/api/src/app.ts` — register audits routes
- `apps/admin-app/src/features/users/UsersPage.tsx` + `users-api.ts` + tests
- `apps/client-portal/src/App.tsx` — register `/set-password`
- `CLAUDE.md`
- `docs/bmad/_bmad-output/implementation-artifacts/sprint-status.yaml`

**Create:**
- `apps/api/src/repositories/audit.repo.ts` + `.test.ts`
- `apps/api/src/routes/audits.routes.ts` + `.test.ts`
- `apps/client-portal/src/features/auth/SetPasswordPage.tsx` + `.test.tsx` (copy from audit-app)

**Delete:** none.

### Project Structure Notes

**Alignment:**
- New `audits.routes.ts` + `audit.repo.ts` follow the existing `me.routes.ts` / `users.routes.ts` and `audit-log.repo.ts` / `user.repo.ts` precedents.
- The client-portal SetPasswordPage triplication mirrors the existing 1.2 auth feature triplication across SPAs.
- `getSurfaceUrl` joins `getAuditAppUrl/getAdminAppUrl/getClientPortalUrl` in `apps/api/src/lib/url.ts` — single discriminated helper instead of three call sites switching on role.

**Detected variances:**
- Free-text `assignedStoreIds` input in admin-app is interim UX. The follow-up store-picker depends on Story 2.1 (`GET /api/v1/stores`) — flagged in Anti-patterns.
- The `GET /api/v1/audits` stub is intentionally minimal; Epic 2 replaces it. The route signature is forward-compatible.
- The `/me` route already returns live `assignedStoreIds` — 1.4 only adds the JSDoc + a test that pins this behaviour against future regression.

### Previous-story intelligence

**1.1, 1.2, 1.3 (review):** complete auth + admin-side foundation. 1.4 widens the user input enum + adds 2 small endpoints + 1 SPA page. All the heavy lifting is already done.

**0-3 audits filter:** `fn_audits_filter(@tenant_id, @store_id)` enforces both tenant scoping AND CLIENT-role store-scoping. 1.4 doesn't touch the SQL — just exercises it via `GET /audits`.

**0-1 deferred-work item still open:** "Three identical copies of api-client / queryClient / index.css across apps — extract to shared `@cems/http` package after first feature story lands and hardens the patterns." The 1.4 SetPasswordPage triplication adds a 5th file to the already-triplicated client-portal/admin-app/audit-app set. Extraction story is overdue but still out of scope here.

### Git intelligence

- Branch naming: `story/1-4-admin-user-management-client-accounts-and-site-assignment`.
- Conventional commit prefix: `feat: client account management + site-scoped audits visibility (Story 1.4)`.
- Two commits expected: (1) `docs: create Story 1.4 context file …` (this file), (2) `feat: … (Story 1.4)`.

### References

- [docs/bmad/_bmad-output/planning-artifacts/epics.md#Story-1.4](../planning-artifacts/epics.md) — ACs lines 607–629
- [docs/bmad/_bmad-output/planning-artifacts/architecture.md#Category-2-Authentication-Security](../planning-artifacts/architecture.md) — RLS predicates including the audits filter
- [packages/db/prisma/migrations/20260424164958_add_rls_and_checks/migration.sql](../../../../packages/db/prisma/migrations/20260424164958_add_rls_and_checks/migration.sql) lines 73–91 — `fn_audits_filter` definition
- [apps/api/src/services/user.service.ts](../../../../apps/api/src/services/user.service.ts) — `createAuditor` to be renamed
- [apps/api/src/routes/users.routes.ts](../../../../apps/api/src/routes/users.routes.ts) — schema widening
- [docs/bmad/_bmad-output/implementation-artifacts/1-3-admin-user-management-auditor-accounts.md](./1-3-admin-user-management-auditor-accounts.md) — handoff source

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
| 2026-05-07 | Initial story file created from epic 1.4 | create-story (claude-opus-4-7[1m]) |
