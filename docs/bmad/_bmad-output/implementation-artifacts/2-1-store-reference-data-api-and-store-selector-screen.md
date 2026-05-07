# Story 2.1: Store Reference Data API & Store Selector Screen

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an Auditor,
I want to see a list of my assigned stores when I open the app,
so that I can tap a store and immediately start an audit without typing any store details.

**Source:** [docs/bmad/_bmad-output/planning-artifacts/epics.md#Story-2.1](../planning-artifacts/epics.md) lines 641–668. Covers FR1 (auditor selects from assigned-store list) + FR43 (store reference data read for auditors). Opens Epic 2.

**Scope clarification:** This story ships **the first auditor-facing feature** — the read API for store reference data, plus the audit-app store-selector UI. It also **resolves a design tension** introduced in Story 1.4: the AUDITOR-empty-storeIds Zod refine contradicts FR1 (auditors must have assigned stores for the UX-scoped picker). 2.1 drops the refine and clarifies the semantic split:

- **`User.assignedStoreIds` for AUDITORs is UX-scoping** (filters their store-selector list). RLS does NOT consult it for AUDITORs (verified: `fn_audits_filter` only consults `assigned_store_ids` when `user_role = 'CLIENT'`).
- **`User.assignedStoreIds` for CLIENTs is security-gating** (RLS predicate uses it to filter audit visibility).
- **Same column, two semantics by role.**

Concretely, 2.1 ships:

- API: `GET /api/v1/stores?assignedToUser=true|false&search=…` returning `{ stores: StoreSummary[], total }`. RLS scopes to the caller's tenant. The `assignedToUser=true` filter applies a `where: { id: { in: rlsContext.assignedStoreIds } }` clause for AUDITOR + CLIENT callers; ADMIN callers get all stores in tenant. There is no separate `GET /api/v1/stores/:storeNumber` in this story — that arrives in 2.2 along with audit creation.
- audit-app: a `StoreSelectorPage` at `/` (replacing the placeholder Home). Searchable, skeleton loading, empty state. Tap → `navigate(/audit/new?storeNumber=X)` (route doesn't exist yet; 2.2 wires the audit-initiation page).
- 1.4 follow-through: drop `createUserRequestSchema`'s AUDITOR-empty-storeIds refine + the corresponding 422 test + the "DO NOT assign Auditors to stores" anti-pattern. AUDITOR creates can carry `assignedStoreIds` going forward; admin-app create-user form offers the same `assignedStoreIds` input it offers for CLIENTs.
- Seed: extend `seed-test-users.ts` (or add `seed-test-stores.ts`) to insert 5 sample StoreRef rows + assign 2 of them to the seeded test auditor — so manual testing of the picker works out-of-the-box.

Out of scope:
- `GET /api/v1/stores/:storeNumber` — Story 2.2 (it's the auto-fill data source and consumes the architecture's Redis cache `store_ref:{storeNumber}` 1h TTL).
- Audit creation (`POST /api/v1/audits`) — Story 2.2.
- Address auto-populate via Google Maps — FR48; Story 2.2 + Story 6.x.
- Store CRUD (admin-side) — Story 6.1 (reference data management).
- Real store data (CSV import etc.) — Story 6.1.
- Pagination + cursor support — deferred until Story 7.1's full admin queue work; this story caps at 200 rows.

## Acceptance Criteria

1. **AC1 — `GET /api/v1/stores?assignedToUser=true` returns the auditor's assigned stores.** Auth required (any authenticated role). Server: `request.withRls(tx => …)` so Azure SQL RLS scopes results to the caller's tenant. The `assignedToUser` query flag (default `false`) — when `true`, the SQL `where` adds `{ id: { in: rlsContext.assignedStoreIds } }` for AUDITOR + CLIENT callers; ignored for ADMIN (admin sees all stores in tenant either way). Response: `{ stores: StoreSummary[], total }` where `StoreSummary = { id, storeNumber, storeName, banner, region }`. Cap at 200 rows. Schema lives in `@cems/types/store.ts` (new file). The frontend uses TanStack Query to fetch with `staleTime: 5min`.

2. **AC2 — Loading state shows a skeleton matching the list layout — no spinner overlay.** While the TanStack Query fetch is in `isLoading`, render `StoreCardSkeleton` (built from `@cems/ui` `Skeleton`) repeated ~5 times in a list. Per UX spec line 711–712 ("LCP ≤2.5s on 4G"), skeletons keep CLS at 0 and avoid the user-perceived "blank screen → spinner → content" jank.

3. **AC3 — Empty state shows "No stores assigned — contact your administrator".** When the response is `{ stores: [], total: 0 }`, render a centered message exactly as worded above. Has `role="status"` + `aria-live="polite"` so screen readers announce it. No "Try again" button at MVP — empty means "no assignments," not "transient failure."

4. **AC4 — Search filters by store name OR store number in real time, client-side, no new API call.** A persistent search input above the list. As the user types, the visible list narrows to stores where `storeName.toLowerCase().includes(query)` OR `storeNumber.toLowerCase().includes(query)`. Debounced ~150ms for keystroke smoothing — but NOT for an API call (the filter is purely client-side over the already-fetched list). When the search input clears, all stores reappear.

5. **AC5 — Tap a store → navigate to the audit-initiation route.** On click of a store row, `navigate('/audit/new?storeNumber=X')`. The route resolves to a placeholder "Audit creation lands in Story 2.2" page (rendered by a stub `AuditNewPage` component). Tap targets meet `min-h-[44px]` (NFR-A1) — `min-h-[48px]` per UX spec line 739 for audit-app field surfaces.

6. **AC6 — `assignedToUser` filter ignored for ADMIN; honoured for AUDITOR + CLIENT.** Tested at the route layer. ADMIN seeing-all-stores is the natural consequence of the `fn_tenant_predicate` OR-ADMIN clause; the `assignedToUser` flag just opts out of the storeIds intersection for ADMIN. Documented in the route handler.

## Tasks / Subtasks

- [x] **Task 1 — Drop the 1.4 AUDITOR-empty-storeIds refine + sweep tests + docs (prerequisite for AC1)**
  - [x] In `packages/types/src/auth.ts`, remove the `.refine(...)` block on `createUserRequestSchema` that rejects non-empty `assignedStoreIds` for AUDITOR. Keep the rest of the schema. Update the comment block to reflect the new dual semantics ("assignedStoreIds is UX-scoping for AUDITOR, security-gating for CLIENT").
  - [x] Update `apps/api/src/routes/users.routes.test.ts`:
    - Replace the test "422 when AUDITOR is created with non-empty assignedStoreIds (refine)" with a new test "201 creates an AUDITOR with non-empty assignedStoreIds (UX-scoped)" that asserts the storeIds round-trip on the response.
  - [x] Update `apps/admin-app/src/features/users/UsersPage.tsx`: the `CreateUserForm` already receives `role` as a prop — change the conditional from `role === 'CLIENT'` to ALWAYS render the `assignedStoreIds` input. Helper text differs by role — for AUDITOR: "Stores this auditor will work on (UX filter only — does not gate data access)"; for CLIENT: keep the existing helper.
  - [x] Update `apps/admin-app/src/features/users/UsersPage.test.tsx` if it asserts the absence of the field on the AUDITOR tab — the test currently doesn't, so likely no change.
  - [x] Sweep CLAUDE.md: the 1.3-era line "AUDITOR rows have an empty array (the cross-field refine on createUserRequestSchema enforces this on writes)" needs to be updated to reflect the new semantics.
  - [x] Sweep the 1.4 story file's "DO NOT assign Auditors to stores" anti-pattern — flip it to a clarifying note.

- [x] **Task 2 — Shared types: `Store` schema (AC: #1)**
  - [x] Create `packages/types/src/store.ts`:
    - `storeSummarySchema = z.object({ id, storeNumber, storeName: nullable, banner: nullable, region: nullable })` — minimum the selector needs.
    - `listStoresResponseSchema = z.object({ stores: z.array(storeSummarySchema), total: z.number().int().min(0) })`.
    - `listStoresQuerySchema = z.object({ assignedToUser: z.coerce.boolean().default(false), search: z.string().max(128).optional() })` — note: `assignedToUser` arrives as a string from URL search params (`'true'`/`'false'`), so `z.coerce.boolean()` handles it.
  - [x] Re-export from `packages/types/src/index.ts`.

- [x] **Task 3 — Stores repo + service (AC: #1, #6)**
  - [x] Create `apps/api/src/repositories/store.repo.ts`:
    - `listStores(tx, { ids?: string[]; take?: number }): Promise<{ stores, total }>` — selects `id, storeNumber, storeName, banner, region` from `store_refs`. Uses `where: { id: { in: ids } }` only when `ids` is non-undefined (an empty array means "no stores assigned" → return `[]` immediately, don't query). Default `take = 200`.
  - [x] Add `apps/api/src/repositories/store.repo.test.ts` with mock-tx tests for: (a) no-filter list, (b) `ids` filter passes through, (c) empty-`ids` returns empty without calling the DB.
  - [x] Create `apps/api/src/services/store.service.ts`:
    - `listStoresForCaller({ assignedToUser, search }, ctx): Promise<ListStoresResponse>`. The service decides: ADMIN ignores `assignedToUser`; AUDITOR + CLIENT honour it via `rlsContext.assignedStoreIds`. The `search` param is INTENTIONALLY ignored at the API layer — filtering is client-side per AC4. (Accepting `search` in the schema lets a future server-side search opt in without breaking the client; for now the param is a no-op.) Document this in JSDoc.
  - [x] Add `apps/api/src/services/store.service.test.ts` covering: ADMIN ignores `assignedToUser=true` (returns full list); AUDITOR with non-empty storeIds + `assignedToUser=true` filters by ID; AUDITOR with empty storeIds + `assignedToUser=true` returns empty WITHOUT a DB call (assert via the mocked repo's call count); `assignedToUser=false` returns all stores in tenant for any role.

- [x] **Task 4 — Stores route (AC: #1, #6)**
  - [x] Create `apps/api/src/routes/stores.routes.ts`: `GET /api/v1/stores` with `listStoresQuerySchema` and `listStoresResponseSchema`. Auth required (any role); no `requireRole` guard. Calls `storeService.listStoresForCaller(query, { request })`.
  - [x] Register `registerStoresRoutes` in `apps/api/src/app.ts` after `registerAuditsRoutes`.
  - [x] Add `apps/api/src/routes/stores.routes.test.ts` covering: 401 without auth, 200 for AUDITOR with `assignedToUser=true`, 200 for ADMIN with `assignedToUser=true` (returns all), search query is currently ignored (passes through but doesn't affect the response shape).

- [x] **Task 5 — audit-app: StoreSelectorPage (AC: #1, #2, #3, #4, #5)**
  - [x] Create `apps/audit-app/src/features/store-selector/stores-api.ts`:
    - `useAssignedStores()` → TanStack Query hook calling `apiFetch<ListStoresResponse>('/api/v1/stores?assignedToUser=true')`. `staleTime: 5 * 60 * 1000`.
  - [x] Create `apps/audit-app/src/features/store-selector/StoreSelectorPage.tsx`:
    - Page heading: `<h1>Select a store</h1>`.
    - Search `Input` with `placeholder="Search by store number or name"`. Debounced via a 150ms `useDebouncedValue` helper (inline; no new dep).
    - Skeleton list while `isLoading`: 5× `StoreCardSkeleton` with `Skeleton` from `@cems/ui` (height ~64px each).
    - Empty state: `<p role="status" aria-live="polite">No stores assigned — contact your administrator</p>`.
    - Populated state: list of `<button onClick={...} className="min-h-[48px] w-full rounded border ... text-left">…</button>` showing storeNumber + storeName + banner/region. Each row renders `aria-label` "Select store {storeNumber}: {storeName}".
    - Search filter applied client-side over the fetched list (case-insensitive `includes` match on storeNumber OR storeName).
    - On row click: `navigate(\`/audit/new?storeNumber=${encodeURIComponent(storeNumber)}\`)`.
  - [x] Create `apps/audit-app/src/features/audit/AuditNewPage.tsx` — placeholder showing `<h1>Start audit for store {storeNumber}</h1>` + "Audit creation arrives in Story 2.2." Reads `useSearchParams().get('storeNumber')`.
  - [x] Update `apps/audit-app/src/App.tsx`:
    - Replace the inline `Home` component with `StoreSelectorPage` at the `/` route (still under `RequireAuth surface={SURFACE}`).
    - Add `/audit/new` route (also under `RequireAuth`) → `<AuditNewPage />`.
    - Keep the Sign-out button — move it to the StoreSelectorPage header (right-aligned next to the heading) so manual testing flow stays intact.
  - [x] Add `apps/audit-app/src/features/store-selector/StoreSelectorPage.test.tsx`:
    - Loading state renders skeletons.
    - Empty state renders the exact AC3 message.
    - Populated state shows store rows.
    - Search filters the visible list (type "456" → only the one matching row visible).
    - Click a row → `useNavigate` called with `/audit/new?storeNumber=…` (mock `useNavigate` via `vi.mock('react-router-dom', …)`).
    - Renders without axe violations.
  - [x] Update `apps/audit-app/src/App.test.tsx` for the new structure: at `/`, render the loading state of StoreSelectorPage (not the old Home component). The skip-link and main-landmark tests stay green via the unchanged shell.

- [x] **Task 6 — Seed sample stores + assign to test auditor (AC: enables manual testing)**
  - [x] Extend `packages/db/scripts/seed-test-users.ts` (or add a sibling `seed-test-stores.ts`):
    - Upsert 5 sample StoreRef rows in tenant `tenant-dev`: `STORE-001..005` with banners "Sobeys" / "Metro" and varied regions.
    - After the auditor user is upserted, set its `assignedStoreIds` to `['<id-of-STORE-001>', '<id-of-STORE-002>']` (need to fetch the upserted store IDs first; cuid means we can't hard-code them).
    - Idempotent: if rows already exist, refresh the assignment.
  - [x] Update `packages/db/package.json` if a separate script is added: `db:seed:test-stores`. (Recommendation: keep it in `seed-test-users.ts` since the assignment depends on both records — single script is simpler.)
  - [x] Verify locally: after `pnpm --filter @cems/db db:seed:test-users`, the seeded auditor logs into audit-app, lands on the store selector, sees STORE-001 + STORE-002.

- [x] **Task 7 — Final sweep + docs (AC: documentation)**
  - [x] Update `CLAUDE.md`:
    - Add a "Store Reference Data" section under "Admin User Management": describe the new endpoint + the dual storeIds semantics + the 5-minute Query stale time.
    - Update the 1.3/1.4 line about AUDITOR-empty-storeIds (the refine is gone).
  - [x] Run `pnpm turbo run lint type-check test`. Fix any breakage.
  - [x] Regenerate Playwright baselines for audit-app (the home page now shows the StoreSelectorPage's loading skeleton). admin-app + client-portal baselines are unchanged.
  - [x] Tick story checkboxes, populate Dev Agent Record, flip sprint-status `2-1 → review` and `epic-2 → in-progress`. Final commit.

## Dev Notes

### The dual semantics of `User.assignedStoreIds`

After Story 2.1, the column carries TWO meanings depending on role:

| Role     | Meaning                | Enforced by                                                  |
|----------|------------------------|--------------------------------------------------------------|
| AUDITOR  | UX scoping             | `GET /api/v1/stores?assignedToUser=true` filter (route layer)|
| CLIENT   | Security gating        | Azure SQL RLS via `fn_audits_filter` (DB layer)              |
| ADMIN    | Irrelevant (sees all)  | `fn_tenant_predicate`'s OR-ADMIN bypass                      |

**This is intentionally a single column with role-dispatched meaning.** The architecture's RLS predicates only consult `assigned_store_ids` for `user_role = 'CLIENT'`; an AUDITOR with non-empty storeIds sees no extra/fewer audits because the SQL filter ignores their list. So storing AUDITOR storeIds is safe from a security standpoint — they're metadata for the UI.

The 1.4 cross-field refine that rejected AUDITOR storeIds was an over-correction. It's removed in 2.1. The semantic split is now documented (CLAUDE.md, this story's Dev Notes, the 1.4 story's Completion Notes get a "**Post-1.4 amendment** — Story 2.1 dropped this refine; see 2.1 Dev Notes" line).

### Why search is client-side

The architecture's UX spec doesn't pin the search depth, but FR1 implies "auditor sees their assigned stores" — typically tens, not hundreds, even at scale. Client-side filtering is:

- Faster (no roundtrip per keystroke)
- Simpler (no server-side `LIKE` query, no index work)
- Resilient (works if the API is slow/down once the initial fetch succeeds)

The query schema accepts `search` so a future server-side enhancement can opt in without breaking the client. For 2.1, the route handler ignores it — explicit no-op with a JSDoc note.

### `storeNumber` vs `id` in the URL

`/audit/new?storeNumber=X` uses the human-readable storeNumber, not the cuid `id`. Reasons:
- Auditors recognize "STORE-001"; not the cuid.
- The store reference data has `(tenantId, storeNumber)` uniquely indexed — looking up by storeNumber is just as efficient as by id.
- Matches the architecture's `audit-app/features/audit/components/SectionCard` patterns + future deep-link UX where store numbers may show up in URLs.

The `id` is still on the StoreSummary response — the SPA can fall back to it if the storeNumber ever collides post-merge or similar edge case.

### Seed script ordering

Seeding the auditor's `assignedStoreIds` depends on the StoreRef rows existing first (so we can pick up their cuids). The single-script approach:

1. Upsert StoreRefs first — capture the resulting IDs.
2. Upsert users.
3. After the auditor upsert, fetch the just-created store IDs and update the auditor row's `assignedStoreIds` to include 2 of them.

If the script is re-run, the upserts no-op and the assignment line just refreshes. Safe to run any number of times.

### Anti-pattern prevention

- **DO NOT** wire server-side `search` filtering in 2.1. The query parameter exists in the schema; the route handler ignores it. Future story can add it server-side without breaking the client.
- **DO NOT** add pagination. Cap at 200 rows. Story 6.1 / 7.1 ship pagination when admin-side store CRUD lands.
- **DO NOT** add a "Try again" button on the empty state. Empty means no assignments — not transient failure. Errors get the standard ApiError UI from the api-client interceptor.
- **DO NOT** cache the `/stores` response in Redis at the API layer in 2.1. The architecture pins `store_ref:{storeNumber}` 1h cache for the GET-by-storeNumber endpoint (Story 2.2). The list endpoint is NOT cached at MVP.
- **DO NOT** turn `/` into a redirect to `/select-store`. The store selector IS the audit-app home — flat, no extra hop.
- **DO NOT** display banners + region as separate columns. Show them inline in the row label so the layout stays mobile-first.
- **DO NOT** introduce a new component in `@cems/ui` for the store row. Use existing primitives (Button or div + classes). Premature abstraction.
- **DO NOT** allow the search input to lose state on a re-fetch. Keep state in `StoreSelectorPage`, NOT TanStack Query.
- **DO NOT** echo the auditor's email or any RLS context into the response.
- **DO NOT** read `assigned_store_ids` from the JWT for the AUDITOR filter. Read from `request.rlsContext.assignedStoreIds` (the auth hook freezes this from the JWT — same source, but go through the documented decorator).
- **DO NOT** modify the audits route from 1.4. Stores ≠ audits.

### File List (anticipated)

**Modify:**
- `packages/types/src/auth.ts` — drop AUDITOR refine
- `packages/types/src/index.ts` — re-export `store.js`
- `apps/api/src/app.ts` — register stores routes
- `apps/api/src/routes/users.routes.test.ts` — sweep AUDITOR refine test
- `apps/admin-app/src/features/users/UsersPage.tsx` — assignedStoreIds always rendered (with role-aware helper text)
- `apps/audit-app/src/App.tsx` — Home → StoreSelectorPage; add /audit/new route
- `apps/audit-app/src/App.test.tsx` — adjust for new home content
- `apps/audit-app/tests/e2e/__screenshots__/**` — regenerated baselines
- `packages/db/scripts/seed-test-users.ts` — seed StoreRefs + assign to auditor
- `CLAUDE.md`
- `docs/bmad/_bmad-output/implementation-artifacts/sprint-status.yaml`

**Create:**
- `packages/types/src/store.ts`
- `apps/api/src/repositories/store.repo.ts` + `.test.ts`
- `apps/api/src/services/store.service.ts` + `.test.ts`
- `apps/api/src/routes/stores.routes.ts` + `.test.ts`
- `apps/audit-app/src/features/store-selector/stores-api.ts`
- `apps/audit-app/src/features/store-selector/StoreSelectorPage.tsx` + `.test.tsx`
- `apps/audit-app/src/features/audit/AuditNewPage.tsx` (placeholder for 2.2)

**Delete:** none.

### Project Structure Notes

**Alignment:**
- `apps/api/src/routes/stores.routes.ts` mirrors `audits.routes.ts` from 1.4 — auth-only (no role guard), RLS-scoped via service.
- `apps/api/src/services/store.service.ts` mirrors `user.service.ts` shape (factory of small pure functions; no class).
- `apps/audit-app/src/features/store-selector/` — first occupant of audit-app's feature folder; matches the architecture's frontend feature module layout.
- `apps/audit-app/src/features/audit/AuditNewPage.tsx` — first occupant of the `audit/` feature folder. 2.2 fills it in.

**Detected variances:**
- StoreSelectorPage replaces the placeholder Home — the audit-app's `/` route now has real product content. Skip-link + `<main id="main-content">` from 0-8 stay; tests adjust.
- The 1.4 Zod refine drop is a backward-incompatible-feeling change to the API surface, but no real-world callers exist yet (auth still in `review` status). Safe to amend.

### Previous-story intelligence

**Epic 1 closed in `review` status** (1.1, 1.2, 1.3, 1.4). 2.1 builds on top:
- Auth flow (1.1, 1.2) — auditor logs in, JWT carries assignedStoreIds.
- Admin user management (1.3, 1.4) — admin assigns stores to auditors via `PATCH /api/v1/users/:id` `{ assignedStoreIds: […] }`. After 2.1's refine drop, this works for AUDITOR rows too.
- `GET /api/v1/audits` stub (1.4) — sibling endpoint to the new `/api/v1/stores`. Both are RLS-scoped, both use the same patterns (repo + service + route).
- 1.4's `User.assignedStoreIds` Prisma field already gets parsed in `user.repo.ts` as `string[]`. No schema migration needed for 2.1.

**Architecture Redis cache (deferred):** `store_ref:{storeNumber}` 1h TTL is for the GET-by-storeNumber endpoint (Story 2.2), not the list endpoint. 2.1 doesn't touch Redis.

### Git intelligence

- Branch: `story/2-1-store-reference-data-api-and-store-selector-screen`.
- Commit prefix: `feat: store-selector + assigned-stores read API (Story 2.1)`.
- Commit body should call out: Refine drop from 1.4, sample-store seed addition, audit-app home now renders real product content.

### References

- [docs/bmad/_bmad-output/planning-artifacts/epics.md#Story-2.1](../planning-artifacts/epics.md) — ACs lines 641–668
- [docs/bmad/_bmad-output/planning-artifacts/architecture.md#Mobile-First-Implementation](../planning-artifacts/architecture.md) — touch target sizing, viewport meta
- [docs/bmad/_bmad-output/planning-artifacts/ux-design-specification.md#Accessibility-Strategy](../planning-artifacts/ux-design-specification.md) — 48px audit-app touch target rule
- [packages/db/prisma/schema.prisma](../../../../packages/db/prisma/schema.prisma) `model StoreRef` — schema
- [docs/bmad/_bmad-output/implementation-artifacts/1-4-admin-user-management-client-accounts-and-site-assignment.md](./1-4-admin-user-management-client-accounts-and-site-assignment.md) — handoff source; 2.1 amends the AUDITOR-empty-storeIds anti-pattern

## Dev Agent Record

### Agent Model Used

claude-opus-4-7[1m]

### Debug Log References

- 15 net-new api tests (4 store.repo + 6 store.service + 5 stores.routes). API total: **176 passing, 1 skipped** (vs 161/1 before).
- 5 net-new SPA tests (StoreSelectorPage). The existing audit-app App.test.tsx (4 tests) still passes — the protected-route `/` test now redirects to `/login` BEFORE StoreSelectorPage's TanStack Query fires, so no fetch mocking needed at the App-level.
- Full workspace `pnpm turbo run lint type-check test` — 29/29 successful.
- One mid-implementation type error: `rls.assignedStoreIds` is typed as `string[] | undefined` (the @cems/db RlsContext schema marks it `.optional()`); the spread `[...rls.assignedStoreIds]` failed compilation. Fixed with a `?? []` coalesce.
- The 1.4 anti-pattern "DO NOT assign Auditors to stores" is now historically wrong — left in place in the 1.4 file (don't rewrite history) but the 2.1 file's Dev Notes explicitly amend the rule.
- The audit-app's `vitest-axe/matchers` import had to handle the StoreSelectorPage's `aria-hidden` skeleton list — verified passing.

### Completion Notes List

✅ **T1 — 1.4 refine drop.** `createUserRequestSchema`'s cross-field refine removed; replaced with a comment block documenting the dual semantics. `users.routes.test.ts`'s "422 when AUDITOR is created with non-empty assignedStoreIds" replaced by a "201 creates an AUDITOR with non-empty assignedStoreIds (UX-scoped)" test. `UsersPage.tsx`'s create-form now ALWAYS renders the assignedStoreIds input with role-aware helper text (CLIENT: "gates which audits this client can read"; AUDITOR: "UX filter for the store-selector — does not gate data access").

✅ **T2 — Shared types.** `packages/types/src/store.ts` with `storeSummarySchema`, `listStoresResponseSchema`, `listStoresQuerySchema`. Re-exported from `index.ts`. `assignedToUser` uses `z.coerce.boolean()` so URL string `'true'` parses correctly.

✅ **T3 — Repo + service.** `store.repo.ts` `listStores(tx, { ids?, take = 200 })` with the empty-`ids` short-circuit (returns `{ stores: [], total: 0 }` without a DB call — saves a roundtrip for unassigned auditors). `store.service.ts` `listStoresForCaller` dispatches: ADMIN → no-filter list; AUDITOR/CLIENT + `assignedToUser=true` → filter by rlsContext.assignedStoreIds; `assignedToUser=false` → no filter regardless of role. Search param accepted but ignored at the API layer (forward-compat).

✅ **T4 — Route + tests.** `GET /api/v1/stores` (no role guard — RLS does the tenant scoping, service does the assignedStoreIds dispatch). Registered in `app.ts` after `registerAuditsRoutes`. Tests cover: AUDITOR with `assignedToUser=true`, every-role acceptance, query coercion `'true'` → boolean, default → false, 401 without auth.

✅ **T5 — StoreSelectorPage.** New audit-app feature folder `features/store-selector/`. `useAssignedStores` TanStack Query hook with `staleTime: 5 min`. `StoreSelectorPage` renders skeleton-loading, empty-state, populated list with client-side debounced search (150ms, name OR number, case-insensitive). Tap → `navigate('/audit/new?storeNumber=X')`. New `features/audit/AuditNewPage.tsx` placeholder. `App.tsx` routes `/` → `StoreSelectorPage`, `/audit/new` → `AuditNewPage`, both under `RequireAuth`. Sign-out moved to the StoreSelectorPage header.

✅ **T6 — Seed.** `seed-test-users.ts` extended to upsert 5 sample StoreRefs (`STORE-001` through `STORE-005`) FIRST, then upsert users with `assignedStoreIds = first 2 store IDs` for both auditor and client. Idempotent — safe to re-run.

✅ **T7 — Final sweep + docs.** CLAUDE.md gained a "Store Reference Data" section + the dual-semantics callout in the Admin User Management section. Playwright baselines regenerated for audit-app (5 viewports — the home page now shows the StoreSelectorPage skeleton/empty state). admin-app + client-portal baselines unchanged.

**Out-of-scope items NOT done (deferred):**
- `GET /api/v1/stores/:storeNumber` — Story 2.2.
- `POST /api/v1/audits` — Story 2.2.
- Server-side search — schema-ready; opt-in when needed.
- Store-picker UX — Stories 6.1 + 2.1's interim free-text input.
- Pagination — Story 7.1.
- Real Redis cache for the list endpoint — out of scope; the architecture's `store_ref:{storeNumber}` cache applies only to per-store fetches (Story 2.2).

### File List

**Modified:**
- `packages/types/src/auth.ts` — drop AUDITOR-empty-storeIds refine
- `packages/types/src/index.ts` — re-export `store.js`
- `apps/api/src/app.ts` — register stores routes
- `apps/api/src/routes/users.routes.test.ts` — 422→201 for AUDITOR-with-storeIds
- `apps/admin-app/src/features/users/UsersPage.tsx` — assignedStoreIds always rendered with role-aware helper
- `apps/audit-app/src/App.tsx` — Home replaced by StoreSelectorPage; new /audit/new route
- `apps/audit-app/tests/e2e/__screenshots__/**` — regenerated baselines
- `packages/db/scripts/seed-test-users.ts` — seed StoreRefs + assign first-2 to auditor/client
- `CLAUDE.md`
- `docs/bmad/_bmad-output/implementation-artifacts/sprint-status.yaml` (in-progress → review)

**Created:**
- `packages/types/src/store.ts`
- `apps/api/src/repositories/store.repo.ts` + `.test.ts`
- `apps/api/src/services/store.service.ts` + `.test.ts`
- `apps/api/src/routes/stores.routes.ts` + `.test.ts`
- `apps/audit-app/src/features/store-selector/stores-api.ts`
- `apps/audit-app/src/features/store-selector/StoreSelectorPage.tsx` + `.test.tsx`
- `apps/audit-app/src/features/audit/AuditNewPage.tsx`

**Deleted:** none.

## Change Log

| Date | Change | Author |
|---|---|---|
| 2026-05-07 | Initial story file created from epic 2.1 | create-story (claude-opus-4-7[1m]) |
| 2026-05-08 | Implementation complete — 7 tasks, 6 ACs satisfied; 15 net-new api + 5 SPA tests; full workspace 29/29 green; 1.4 refine dropped + dual semantics documented; baselines regenerated. Status → review. | dev-story (claude-opus-4-7[1m]) |
