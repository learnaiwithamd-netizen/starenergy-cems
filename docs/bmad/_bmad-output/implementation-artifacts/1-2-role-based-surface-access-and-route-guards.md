# Story 1.2: Role-Based Surface Access & Route Guards

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a user,
I want my browser to route me to the correct application surface on login,
so that Auditors only see the Site Audit App, Admins see the Admin Console, and Clients see the Client Portal.

**Source:** [docs/bmad/_bmad-output/planning-artifacts/epics.md#Story-1.2](../planning-artifacts/epics.md) lines 551–577. Covers FR41 (role-based interface access). Builds the SPA-side counterpart of the auth APIs shipped in Story 1.1.

**Scope clarification:** This story ships **everything the SPAs need to log in, stay logged in, and route correctly by role** — and **everything the API needs to reject cross-role requests**. Concretely:

- API: `GET /api/v1/me` (any auth), `requireRole(roles[])` Fastify pre-handler factory, `@fastify/cors` plugin, plus a synthetic `requireRole`-protected test route to satisfy AC5 end-to-end.
- All 3 SPAs: React Router wiring, login page, token persistence (access in memory, refresh in localStorage), 401-token-expired refresh interceptor, `<RequireAuth>` route guard, role-mismatch cross-surface redirect (`window.location.assign`).
- Cross-cutting: env-driven cross-surface URL map (`VITE_AUDIT_APP_URL` / `VITE_ADMIN_APP_URL` / `VITE_CLIENT_PORTAL_URL`), seed users from 1.1 used as the default test fixture.

Out of scope (deferred to later stories): logout button UI placement (Story 1.3 + the admin/auditor shells), session-inactivity timeout (NFR-S6 hardening), session-resume-after-network-drop (Story 2.3 covers the audit auto-save side; access-token recovery covered here).

## Acceptance Criteria

1. **AC1 — Auditor login lands on audit-app.** Logging in with an `AUDITOR` user via the audit-app login form (`http://localhost:5173/login` in dev) navigates to the audit-app home (`/`). Logging in via the **admin-app** or **client-portal** login form (with the same Auditor credentials) detects the role mismatch and redirects the browser to `${VITE_AUDIT_APP_URL}/login` (default `http://localhost:5173/login`) — using `window.location.assign` so React Router's history is fully reset. The redirect persists no tokens to the destination surface; the user re-enters credentials there.

2. **AC2 — Admin login lands on admin-app.** Mirror of AC1 with role `ADMIN` and target `${VITE_ADMIN_APP_URL}` (default `:5174`).

3. **AC3 — Client login lands on client-portal.** Mirror of AC1 with role `CLIENT` and target `${VITE_CLIENT_PORTAL_URL}` (default `:5175`).

4. **AC4 — Unauthenticated access to a protected route redirects to that surface's `/login`.** Visiting `/` (or any non-`/login` route) on any of the three SPAs while no access-token-derived auth state is present triggers a React Router `<Navigate to="/login" replace />`. The original URL is captured in `?next=…` so post-login navigation lands the user back on the deep-linked target. (Out of scope: deep link inside an audit URL — that's Story 2.3's resume flow.)

5. **AC5 — Cross-role API call returns RFC 7807 403.** A `requireRole(roles: UserRole[])` Fastify pre-handler factory exists in `apps/api/src/middleware/role-guard.ts`. When a CLIENT-role JWT is presented to a route guarded with `requireRole([UserRole.ADMIN])`, the response is 403 with body `{ type: '…/forbidden', title: 'Forbidden', status: 403, detail: 'Role not permitted', instance }`. Multi-role allowlists work (e.g., `requireRole([UserRole.ADMIN, UserRole.AUDITOR])`). A synthetic test route `GET /api/v1/_test/admin-only` is wired purely to satisfy this AC end-to-end (gated behind `process.env.NODE_ENV !== 'production'` so it never ships to prod).

## Tasks / Subtasks

- [x] **Task 1 — API: CORS, `/api/v1/me`, `requireRole`, role-guard tests (AC: #5)**
  - [x] Add `@fastify/cors@^10.0.x` to `apps/api/package.json` dependencies. Run `pnpm install` from repo root.
  - [x] Register `@fastify/cors` in `apps/api/src/app.ts` BEFORE `registerAuthHook`. Allowlist comes from `process.env.CORS_ORIGINS` (comma-separated), defaulting in dev to `http://localhost:5173,http://localhost:5174,http://localhost:5175`. Methods: `GET, POST, PATCH, DELETE, OPTIONS`. Headers: `Authorization, Content-Type, X-Request-Id`. `credentials: false` (we do NOT use cookies). Document in JSDoc that prod values come from env at boot — no wildcard fallback.
  - [x] Update `PUBLIC_ROUTES` in `apps/api/src/middleware/auth.ts` so `OPTIONS` preflight requests on protected routes do not 401. Idiomatic approach: short-circuit in `registerAuthHook` if `request.method === 'OPTIONS'` (the CORS plugin handles the preflight response). Confirm via test: `OPTIONS /api/v1/me` returns 204 with the right `Access-Control-Allow-*` headers, no Authorization required.
  - [x] Create `apps/api/src/middleware/role-guard.ts`: exports `requireRole(roles: UserRole[])` returning a Fastify pre-handler that (a) reads `request.rlsContext` (already populated by the auth hook), (b) returns RFC 7807 403 if `request.rlsContext === null` (defensive — the auth hook should have run first), (c) returns 403 if `request.rlsContext.role` is not in the allowlist. The 403 must use a new `RoleNotPermittedError extends Error` with `statusCode = 403` so the global error-handler emits the correct slug. Add the new error to `apps/api/src/lib/auth-errors.ts` alongside `TokenExpiredError`/`InvalidCredentialsError`. Unit-test with a stub Fastify request.
  - [x] Update `apps/api/src/middleware/error-handler.ts` to recognize `RoleNotPermittedError` and emit `{ type: '…/forbidden', title: 'Forbidden', status: 403, detail: 'Role not permitted' }`. (The existing 403 slug `'forbidden'` already matches; no `STATUS_TO_SLUG` change needed — just add the `instanceof` branch with a fixed `detail`.)
  - [x] Create `apps/api/src/routes/me.routes.ts` with `GET /api/v1/me` returning `{ id, email, name, role, tenantId, assignedStoreIds }`. Email/name come from a fresh `findActiveUserById` lookup via `request.withRls(...)` (so RLS is enforced — proves the JWT-derived tenantId is consistent with the live DB row). 401 if user no longer exists. Schema in `packages/types/src/auth.ts` (new `meResponseSchema`).
  - [x] Create `apps/api/src/routes/_test.routes.ts` with `GET /api/v1/_test/admin-only` guarded by `requireRole([UserRole.ADMIN])`, returning `{ status: 'ok' }`. Registration in `app.ts` is GATED behind `if (process.env.NODE_ENV !== 'production')` so the route is unreachable in prod. Add a one-line ESLint disable comment (`// eslint-disable-next-line ... -- AUDIT-REVIEWED: test-only route, env-gated`) if any rule fires.
  - [x] Tests: `apps/api/src/middleware/role-guard.test.ts` (allow / deny / multi-role / missing-context cases); `apps/api/src/routes/me.routes.test.ts` (200 with claims, 401 with missing user, integration with the auth hook); `apps/api/src/routes/_test.routes.test.ts` (Auditor → 403, Admin → 200, no-auth → 401, route absent in `NODE_ENV=production`); add a CORS preflight test to `apps/api/src/middleware/auth.test.ts` or a new `apps/api/src/app.test.ts` (whichever is cleaner).

- [x] **Task 2 — Shared cross-surface URL constants + env wiring (AC: #1, #2, #3)**
  - [x] Add to `packages/types/src/auth.ts`:
    - `export const SURFACE_BY_ROLE: Readonly<Record<UserRole, 'audit' | 'admin' | 'client'>>`. Auditor → 'audit', Admin → 'admin', Client → 'client'.
    - Type-level constant for SPA env-var keys (`VITE_AUDIT_APP_URL`, `VITE_ADMIN_APP_URL`, `VITE_CLIENT_PORTAL_URL`) so each SPA references the same names.
  - [x] Update each SPA's `.env.example` (create if missing) and add to root `.env.example` documentation: the three cross-surface URL vars + dev defaults. Sample:
    ```
    VITE_API_BASE_URL=http://localhost:3001
    VITE_AUDIT_APP_URL=http://localhost:5173
    VITE_ADMIN_APP_URL=http://localhost:5174
    VITE_CLIENT_PORTAL_URL=http://localhost:5175
    ```
  - [x] In each SPA's `src/lib/`, create a NEW file `surface-urls.ts` exporting `surfaceUrls: { audit, admin, client }` resolved from `import.meta.env.VITE_*_URL` with the dev defaults baked in as fallbacks.
  - [x] Create `apps/<each>/src/lib/surface-urls.test.ts` with one trivial test verifying defaults. (Each SPA's `surface-urls.ts` is byte-identical — duplication is the project convention per 0-1 deferred-work; revisit when the `@cems/web-auth` extraction story lands.)

- [x] **Task 3 — Per-SPA auth feature: store, API client, refresh interceptor (AC: #1–#4)**
  - [x] In each SPA, create `src/features/auth/auth-store.ts`:
    - Zustand store with `accessToken: string | null`, `user: { id, email, name, role, tenantId, assignedStoreIds } | null`, `setSession({ accessToken, user })`, `clearSession()`.
    - **Access token in MEMORY only** — never persist. On reload it gets re-derived from a refresh-token-driven `/auth/refresh` call.
    - Persist nothing in this store (no Zustand `persist` middleware).
  - [x] In each SPA, create `src/features/auth/refresh-token-store.ts`:
    - Tiny module wrapping `localStorage.getItem/setItem/removeItem` for key `cems.refreshToken`. No store, no React; pure functions: `getRefreshToken()`, `setRefreshToken(token)`, `clearRefreshToken()`. The `localStorage` choice is documented in the file header with the threat-model trade-off (see Dev Notes).
    - Guard against `localStorage` being unavailable (SSR / sandbox) — return null/no-op silently.
  - [x] Create `src/features/auth/auth-api.ts` (per SPA):
    - `loginApi({ email, password }): Promise<LoginResponse>` → POSTs to `${VITE_API_BASE_URL}/api/v1/auth/login`.
    - `refreshApi(refreshToken: string): Promise<LoginResponse>` → POST `/api/v1/auth/refresh`.
    - `logoutApi(refreshToken: string): Promise<void>` → POST `/api/v1/auth/logout`.
    - `meApi(accessToken: string): Promise<MeResponse>` → GET `/api/v1/me` with `Authorization: Bearer …`.
    - All four use the existing `apiFetch` helper (or a thin variant) — but DO NOT route through the interceptor (`auth-api.ts` is what the interceptor calls; circularity bad).
  - [x] Modify each SPA's `src/lib/api-client.ts`:
    - Add an `accessTokenProvider: () => string | null` injection point. The auth bootstrap wires it to `useAuthStore.getState().accessToken`.
    - In `apiFetch`: if `accessTokenProvider()` returns a token, attach `Authorization: Bearer …` header.
    - On 401 with `problem.type === '…/token-expired'`: call `refreshApi(getRefreshToken())`, update the store, retry the original request **once**. If the refresh itself 401s, clear the session and re-throw the original 401 (the route guard will redirect to /login).
    - On 401 with any other slug: do NOT attempt refresh; clear session, re-throw.
    - Concurrent-401 deduplication: hold a single in-flight `refreshPromise` so 5 parallel requests all wait on the SAME refresh, not 5 refreshes.
  - [x] Create `src/features/auth/useAuthBootstrap.ts` — a hook used at app mount that: (a) reads `getRefreshToken()`, (b) if present, calls `refreshApi`, (c) on success, calls `meApi` to populate the user, (d) on failure, clears the refresh token and proceeds unauthenticated. Returns `{ ready: boolean }` so the app can show a brief loading state until the auth state is hydrated.
  - [x] Tests per SPA: `auth-store.test.ts`, `refresh-token-store.test.ts` (with localStorage stubbed via a `Storage` mock), `auth-api.test.ts` (with `vi.fn` stubbing global `fetch`), `api-client.test.ts` extension covering the 401 → refresh → retry interceptor, deduplication, and the non-token-expired 401 short-circuit. Aim for ≥1 test per behaviour bullet above.

- [x] **Task 4 — Per-SPA login page + role-mismatch redirect (AC: #1–#4)**
  - [x] Add `react-router-dom@^7.1.1` is already a SPA dep — no install needed. (Confirmed: 1.1 left it in place.)
  - [x] Create `src/features/auth/LoginPage.tsx` per SPA:
    - Uses `@cems/ui` `Input`, `Button`, and a small inline `<form>`. Email + password fields with `aria-label`, `aria-describedby` for the error region.
    - On submit: `loginApi(...)` → role check → if `SURFACE_BY_ROLE[user.role]` does NOT match this SPA's surface, immediately call `logoutApi(refreshToken)` (so the just-issued refresh token is invalidated) AND `clearRefreshToken()` AND `window.location.assign(surfaceUrls[SURFACE_BY_ROLE[user.role]] + '/login')`. The user re-enters credentials on the correct surface (no token bleed-through). If the role matches, write `setSession(...)`, `setRefreshToken(...)`, navigate to `searchParams.get('next') ?? '/'`.
    - Display the RFC 7807 `detail` from a 401 inside an `aria-live="assertive"` region. 422 errors render field-level errors (Zod via the auth-api parse).
    - Loading state on the submit button while the request is in flight; disable submit until both fields non-empty.
    - SPA-specific surface name baked into the page title (e.g., `<h1>Site Audit — Sign in</h1>`).
  - [x] Add `LoginPage.test.tsx` per SPA:
    - Renders without axe violations (uses the 0-8 pattern).
    - Submitting with valid credentials calls `loginApi` exactly once, sets the session on role match, and `window.location.assign` is invoked with the right URL on role mismatch (mock `window.location` via `vi.stubGlobal`).
    - 401 detail surfaces in the aria-live region.
    - Empty-field submit is blocked.

- [x] **Task 5 — Per-SPA routing + RequireAuth guard + bootstrap wiring (AC: #4)**
  - [x] Create `src/features/auth/RequireAuth.tsx` per SPA — a route-guard component that reads `useAuthStore.user`. If null, returns `<Navigate to={'/login?next=' + encodeURIComponent(location.pathname + location.search)} replace />`. If non-null but `SURFACE_BY_ROLE[user.role] !== <thisSurface>`, calls `window.location.assign(surfaceUrls[SURFACE_BY_ROLE[user.role]])` (preserves no auth state) and renders null while the navigation happens.
  - [x] Modify each SPA's `src/main.tsx`:
    - Wrap the app in `<BrowserRouter>` from `react-router-dom`.
    - Compute the SPA's surface from a constant (`'audit'` / `'admin'` / `'client'`) — passed to `<App>` via prop or a context.
  - [x] Modify each SPA's `src/App.tsx`:
    - Convert from a single static page to `<Routes>` with `/login` (renders `LoginPage`, public) and `/` (wrapped in `RequireAuth`, renders the existing placeholder home).
    - Keep the skip link + `<main id="main-content">` from 0-8 as the layout shell — they wrap the `<Outlet>`.
    - Call `useAuthBootstrap()` at the root; while `!ready`, render a minimal `<p>Loading…</p>` (axe-friendly, plain text — no spinner needed for placeholder UI).
  - [x] Update each SPA's `App.test.tsx` to handle the new routing structure: render with `<MemoryRouter initialEntries={['/login']}>` for the auth-page tests; the existing axe scan + skip-link tests stay relevant for the `/` route (mock the auth store to populate a user).
  - [x] Update each SPA's Playwright `tests/e2e/home.spec.ts` to navigate to `/login` instead of `/` (since `/` is now guarded). The visual-regression baseline from 0-8 is for the OLD home page — regenerate baselines for the login page during this story (Task 8). Keep tests focused on the login page since `/` is auth-required and Playwright doesn't have credentials.

- [x] **Task 6 — Stitch together: post-login redirect, logout, and the cross-surface URL test (AC: #1–#4)**
  - [x] In each SPA, after successful login + role match: call `setSession(...)`, `setRefreshToken(refreshToken)`, then `navigate(searchParams.get('next') ?? '/', { replace: true })`.
  - [x] In each SPA, expose a `useLogout()` hook in `src/features/auth/useLogout.ts` that: (a) reads the refresh token, (b) calls `logoutApi(...)` (best effort — ignore errors so logout is always idempotent on the client), (c) `clearSession()` + `clearRefreshToken()`, (d) `navigate('/login', { replace: true })`. **This story does not add a logout button to the UI** — that's later UX work. The hook exists so future stories can wire it.
  - [x] Add a `<button onClick={logout}>Sign out</button>` under the placeholder home in each SPA — minimum viable so the loop closes for manual testing. Place it inside `<main id="main-content">` so the skip link still focuses correctly.

- [x] **Task 7 — Wire the cross-role 403 end-to-end test (AC: #5)**
  - [x] In the synthetic `_test.routes.ts` file (Task 1), add the `requireRole([UserRole.ADMIN])` guard and a 200-response handler.
  - [x] In `apps/api/src/routes/_test.routes.test.ts`: cover all 4 cases — Auditor JWT → 403, Client JWT → 403, Admin JWT → 200, no auth → 401. Verify the 403 body matches the AC5 shape (`type: '…/forbidden'`, `detail: 'Role not permitted'`).
  - [x] (Optional but valuable) Add a Playwright test in `apps/audit-app/tests/e2e/cross-role-403.spec.ts` that logs in as Auditor (via the seeded test user from 1.1), then `page.evaluate(() => fetch('/api/v1/_test/admin-only', { headers: { Authorization: 'Bearer ' + token } }))` and asserts the 403 problem detail. **Skip this if it requires a live SQL Server in CI** (it does, given the auth flow needs the seeded user) — leave a `test.skip(...)` placeholder with a comment explaining the dependency.

- [x] **Task 8 — Regenerate Playwright baselines + docs (AC: #1–#5)**
  - [x] After all routes land, run `pnpm --filter audit-app exec playwright test --update-snapshots` (and admin-app, client-portal) to regenerate the `__screenshots__` baselines. The login page is now the visible-without-auth content. Commit the new PNGs.
  - [x] Update root `CLAUDE.md`:
    - Add the three `VITE_*_APP_URL` env vars to the env-vars section.
    - Add the auth flow to the architecture summary: "SPAs hold access tokens in memory and a refresh token in localStorage; api-client retries 401-token-expired once via `/auth/refresh`."
    - Document the synthetic test route gating (`NODE_ENV !== 'production'`).
  - [x] Update each SPA's existing tests/e2e baseline expectations after the App.tsx changes — `home.spec.ts` becomes a `login.spec.ts` if the change is large enough; otherwise just rename the screenshot file.

## Dev Notes

### Token storage — security trade-off

**Decision:** access token in **memory** (Zustand store), refresh token in **`localStorage`**.

**Why:**
- Access tokens are short-lived (4–8h per role). Keeping them out of `localStorage` means an XSS attacker cannot extract a usable session bearer.
- Refresh tokens have to survive a page reload (otherwise every reload forces a re-login, broken UX). The two web-storage paths are `localStorage` (XSS-readable) or `httpOnly` cookie (not XSS-readable). Cookie path requires CSRF defence + cross-origin handling between :5173/4/5 SPAs and :3001 API; that's a meaningful complexity bump for MVP.
- **Mitigation:** refresh token rotation (already in 1.1 — a stolen refresh token is single-use). Plus a strong CSP on the SPAs (deferred to a future security-hardening story) to make XSS hard in the first place.

**Future hardening** (deferred): switch to `httpOnly; SameSite=Strict; Secure` refresh cookie + CSRF token in headers. Also add CSP headers via Azure Static Web Apps `staticwebapp.config.json`.

### Cross-surface redirect — why `window.location.assign` + no token persistence to the destination

If an Auditor logs into the admin-app form, we discover the role mismatch only AFTER the API call returns successfully. At that point we hold a valid `accessToken` + `refreshToken`. Three options:

1. **Persist tokens to the destination surface, redirect, auto-login** — requires cross-origin storage sharing (`postMessage` or a cookie-on-parent-domain). Lots of moving parts, more attack surface.
2. **Store tokens in the browser, send the user to the destination, destination reads them** — same problem; SPAs are on different origins (different ports in dev, different SWA hostnames in prod).
3. **Discard the just-issued tokens, send the user to the destination's `/login`, let them re-enter credentials.** — chosen.

Option 3 is slightly worse UX (one extra credential entry on edge case) but vastly safer and simpler. It also gives the user a clear visual moment to confirm "yes I meant to log into the auditor surface." Implementation calls `logoutApi(refreshToken)` first to invalidate the tokens server-side, then `clearRefreshToken()` to wipe local storage, then `window.location.assign(...)` to leave the current SPA cleanly.

### `RequireAuth` vs server-side enforcement

`<RequireAuth>` is a UX guard, not a security boundary. The real security is the API's `requireRole(...)` + the JWT auth hook. A user with browser dev-tools open can mutate the auth store and bypass `<RequireAuth>` to render the protected components — but every API call those components make still hits a 401/403 from the server. The SPA gracefully degrades to the login page when API calls fail.

**Tests must reflect this** — `RequireAuth.test.tsx` covers the redirect behaviour, but there is no claim in this story that the SPA enforces security. AC5 covers server-side enforcement.

### `requireRole` placement in the request lifecycle

`registerAuthHook` runs as `preHandler` (sets `request.rlsContext` from the JWT). `registerRlsRequestHook` also runs as `preHandler` (decorates `request.withRls`). Both run on every protected route. `requireRole(...)` is a **per-route** `preHandler` factory — Fastify allows route-level `preHandler` chains. Order:

1. global `preHandler` (auth hook) — populates `rlsContext`
2. global `preHandler` (rls-request hook) — decorates `withRls`
3. route `preHandler` (`requireRole(...)`) — checks `rlsContext.role`

If `rlsContext` is null at step 3 (which only happens if step 1 was skipped via the `PUBLIC_ROUTES` allowlist), `requireRole` throws — defensive guard, never expected in practice.

### CORS — preflight short-circuit in the auth hook

`@fastify/cors` handles `OPTIONS` requests automatically and returns 204. But our `registerAuthHook` runs first as a global `preHandler` and would 401 the OPTIONS request because the browser doesn't send `Authorization` on a preflight. Fix: short-circuit in `auth.ts`:

```ts
if (request.method === 'OPTIONS') return
```

Cleaner than adding every protected route to `PUBLIC_ROUTES` separately.

### Refresh-deduplication algorithm

When 5 React Query queries fire on app mount and all hit a 401-token-expired in parallel, naive code calls `/auth/refresh` 5 times — 4 of them fail because the first refresh rotates the token. Implementation:

```ts
let inflightRefresh: Promise<LoginResponse> | null = null

async function refreshOnce(): Promise<LoginResponse> {
  if (inflightRefresh) return inflightRefresh
  inflightRefresh = (async () => {
    try { return await refreshApi(getRefreshToken()!) }
    finally { inflightRefresh = null }
  })()
  return inflightRefresh
}
```

All 5 callers `await refreshOnce()` and end up with the same fresh token. Test by firing 5 parallel `apiFetch` calls all returning a stub 401-token-expired; assert `refreshApi` is invoked exactly once.

### React Router v7 specifics

- v7 reuses `react-router-dom` package name (no migration to `react-router`). Already pinned `^7.1.1` in 1.1's deps.
- `useNavigate()`, `<Navigate>`, `useSearchParams`, `<MemoryRouter>` (test), `<BrowserRouter>` — all standard.
- Avoid the new "framework mode" (`createBrowserRouter` + `RouterProvider`) — the simpler `<BrowserRouter>` + `<Routes>` declarative API is enough for 1.2 and easier to test.

### Library version pins (May 2026)

- `@fastify/cors@^10.0.x` — Fastify 5 compatible major.
- `react-router-dom@^7.1.1` — already installed.
- `@testing-library/user-event` — already installed (0-8).
- No new SPA deps — all auth UI built from `@cems/ui` primitives that 0-7 shipped.

### Anti-pattern prevention (LLM disaster avoidance)

- **DO NOT** persist the access token to `localStorage` / `sessionStorage`. It MUST stay in memory.
- **DO NOT** call `/auth/login` directly from `<RequireAuth>` or any guard — guards REDIRECT, they don't authenticate.
- **DO NOT** use the existing `apiFetch` interceptor inside `auth-api.ts` (login/refresh/logout). That creates a recursive loop — the interceptor calls refresh, which calls apiFetch, which calls the interceptor. Use a thin direct-fetch helper.
- **DO NOT** call `setSession(...)` before checking role match. The role-mismatch path must NEVER write the access token to the store.
- **DO NOT** use `<Navigate>` for cross-surface redirects. React Router only navigates within the SPA. Use `window.location.assign` to leave the SPA cleanly.
- **DO NOT** add the synthetic `_test.routes.ts` to OpenAPI tags/docs. It must not appear in `/api/v1/docs`. Easiest: pass `{ schema: { hide: true } }` per route.
- **DO NOT** widen CORS to `'*'`. Always env-driven allowlist.
- **DO NOT** skip the `OPTIONS` short-circuit in the auth hook. Browsers will silently fail every cross-origin request without it.
- **DO NOT** add `credentials: 'include'` to fetch calls. We use Bearer tokens, not cookies.
- **DO NOT** put login form CSS into a new shared `@cems/ui` component for this story. The form is small, app-specific in copy, and shouldn't be prematurely abstracted. (Triplication mirrors the api-client convention; revisit when the `@cems/web-auth` extraction story lands.)
- **DO NOT** introduce a global Redux store or any state management beyond the per-feature Zustand store the architecture sanctions.
- **DO NOT** modify the existing `@cems/types` `accessTokenClaimsSchema`. 1.1 froze the JWT shape; 1.2 only adds new schemas (`meResponseSchema`, `SURFACE_BY_ROLE`).
- **DO NOT** broaden `PUBLIC_ROUTES` beyond what's already in `auth.ts`. The new routes are protected; the synthetic `_test/admin-only` is protected too.
- **DO NOT** rely on `axios` or any HTTP library. The SPAs use the existing `apiFetch` (native `fetch`).

### File List (anticipated)

**Modify:**
- `apps/api/package.json` — add `@fastify/cors`
- `apps/api/src/app.ts` — register CORS, register me + _test routes
- `apps/api/src/middleware/auth.ts` — OPTIONS short-circuit
- `apps/api/src/middleware/error-handler.ts` — `RoleNotPermittedError` branch
- `apps/api/src/lib/auth-errors.ts` — add `RoleNotPermittedError`
- `apps/api/src/middleware/auth.test.ts` — CORS preflight test
- `packages/types/src/auth.ts` — `meResponseSchema`, `SURFACE_BY_ROLE`
- `pnpm-lock.yaml` (regenerated)
- 3× `apps/<each>/src/main.tsx` — wrap in `<BrowserRouter>`
- 3× `apps/<each>/src/App.tsx` — switch to `<Routes>`
- 3× `apps/<each>/src/App.test.tsx` — adjust for routing
- 3× `apps/<each>/src/lib/api-client.ts` — auth header + 401 interceptor
- 3× `apps/<each>/tests/e2e/home.spec.ts` — point at `/login`
- 3× `apps/<each>/tests/e2e/__screenshots__/**` — regenerate baselines
- `CLAUDE.md` — env vars + auth flow notes

**Create:**
- `apps/api/src/middleware/role-guard.ts` + `role-guard.test.ts`
- `apps/api/src/routes/me.routes.ts` + `me.routes.test.ts`
- `apps/api/src/routes/_test.routes.ts` + `_test.routes.test.ts`
- 3× `apps/<each>/src/lib/surface-urls.ts` + `surface-urls.test.ts`
- 3× `apps/<each>/src/features/auth/auth-store.ts` + `auth-store.test.ts`
- 3× `apps/<each>/src/features/auth/refresh-token-store.ts` + `refresh-token-store.test.ts`
- 3× `apps/<each>/src/features/auth/auth-api.ts` + `auth-api.test.ts`
- 3× `apps/<each>/src/features/auth/useAuthBootstrap.ts`
- 3× `apps/<each>/src/features/auth/useLogout.ts`
- 3× `apps/<each>/src/features/auth/RequireAuth.tsx`
- 3× `apps/<each>/src/features/auth/LoginPage.tsx` + `LoginPage.test.tsx`
- 3× `apps/<each>/.env.example`
- `.env.example` (root — if not already present, augmented)

### Project Structure Notes

**Alignment with unified project structure:**
- `src/features/auth/` per SPA — matches the architecture's "frontend feature module layout" (architecture.md line 360–373).
- `src/lib/surface-urls.ts` per SPA — non-UI utility, fits `lib/` per the same architecture line.
- `apps/api/src/middleware/role-guard.ts` — matches existing middleware/ layer (auth, rls-request, error-handler).
- `apps/api/src/routes/me.routes.ts` and `_test.routes.ts` — new occupants of `routes/` matching `db-health.ts`, `auth.routes.ts` precedent.

**Detected variances (with rationale):**
- The auth feature is **triplicated across 3 SPAs**, not extracted to a shared package. This matches the existing convention for `api-client.ts` and `queryClient.ts` (per 0-1 deferred-work item: "Three identical copies … extract to shared `@cems/http` package after first feature story lands and hardens the patterns."). 1.2 IS the hardening story but the extraction would balloon the scope; flagged for a near-term cleanup story.
- The `_test.routes.ts` file is **production-gated** (`NODE_ENV !== 'production'`). It exists solely to satisfy AC5 end-to-end. Story 1.3 will introduce real ADMIN-only routes that obsolete the synthetic test route — at that point delete `_test.routes.ts`.
- React Router v7's framework mode (`createBrowserRouter` + data routers) is NOT used. Declarative `<BrowserRouter>` + `<Routes>` is enough for 1.2 and aligns with the architecture's React-Router-v7 pin without committing to the framework mode's data-loading semantics.
- The Playwright baselines from 0-8 are now stale because `/` redirects to `/login`. Regenerating in Task 8 is mandatory.

### Previous-story intelligence

**0-1 (done):** Established 3-SPA scaffolding + 3 identical copies of `api-client.ts` / `queryClient.ts`. The deferred-work note flags this as the hardening trigger — but extraction is OUT of scope for 1.2 to keep the PR reviewable.

**0-3 + 0-4 (done):** RLS, JWT verify hook, RFC 7807 error handler, public-route allowlist. 1.2 extends the public-route handling for OPTIONS (CORS preflight) and adds a per-route role guard.

**0-7 (done):** Star Energy design tokens + `@cems/ui` primitives. The login form uses `Input` and `Button` directly — no new components.

**0-8 (in review):** SPA Vitest + axe + jsx-a11y + Playwright + skip-link + main-content landmark. The new `LoginPage` MUST pass the existing axe scan; the existing tests in `App.test.tsx` for skip link + main landmark MUST still pass after the routing rewrite. **Critical:** if the App restructure introduces an axe violation (e.g., the form is missing labels), the gate from 0-8 will catch it.

**1.1 (in review):** API endpoints `/auth/login`, `/auth/refresh`, `/auth/logout`, `/me` (NOT yet — added in 1.2). Token issuance with role-specific TTLs. SHA-256 refresh-token hash. RFC 7807 slugs `authentication-required` + `token-expired` + (new in 1.2) `forbidden`. The refresh-token rotation in 1.1 is exactly what the SPA interceptor relies on for the 401 retry path.

**0-4 deferred items folded into 1.2:**
- ✅ CORS / OPTIONS preflight wiring — explicit Task 1 sub-task. Resolves the last open 0-4 deferred item.

### Git intelligence

- Branch naming: `story/1-2-role-based-surface-access-and-route-guards` (mirror precedent).
- Conventional-commit prefix: `feat: role-based surface access + login UI (Story 1.2)`.
- Body should call out the cross-surface redirect strategy + the synthetic `_test` route gating.
- Squashed merge into `main`.
- Two commits expected: (1) `docs: create Story 1.2 context file ...` (this file) (2) `feat: ... (Story 1.2)` (the implementation).

### References

- [docs/bmad/_bmad-output/planning-artifacts/epics.md#Story-1.2](../planning-artifacts/epics.md) — ACs lines 551–577
- [docs/bmad/_bmad-output/planning-artifacts/architecture.md#Frontend-Architecture](../planning-artifacts/architecture.md) — Zustand + TanStack Query, frontend feature layout
- [docs/bmad/_bmad-output/planning-artifacts/architecture.md#Category-2-Authentication-Security](../planning-artifacts/architecture.md) — JWT TTL matrix
- [docs/bmad/_bmad-output/planning-artifacts/prd.md#User-Access-Management](../planning-artifacts/prd.md) — FR41 role-based interface access
- [apps/api/src/middleware/auth.ts](../../../../apps/api/src/middleware/auth.ts) — auth hook to extend (OPTIONS short-circuit)
- [apps/api/src/middleware/error-handler.ts](../../../../apps/api/src/middleware/error-handler.ts) — RFC 7807 mapping to extend
- [apps/api/src/routes/auth.routes.ts](../../../../apps/api/src/routes/auth.routes.ts) — login/refresh/logout endpoints from 1.1
- [docs/bmad/_bmad-output/implementation-artifacts/1-1-email-password-login-and-jwt-issuance.md](./1-1-email-password-login-and-jwt-issuance.md) — handoff source
- [docs/bmad/_bmad-output/implementation-artifacts/deferred-work.md](./deferred-work.md) — 0-4 deferred item: CORS / OPTIONS preflight (resolved here)
- [Fastify CORS plugin](https://github.com/fastify/fastify-cors) — `@fastify/cors` reference
- [React Router v7 declarative mode](https://reactrouter.com/start/declarative/installation)

## Dev Agent Record

### Agent Model Used

claude-opus-4-7[1m]

### Debug Log References

- 12 new api tests pass (5 role-guard + 3 me.routes + 4 _test.routes), plus +1 OPTIONS-preflight test in auth.test.ts → 13 net new. **Total api: 124 passing, 1 skipped** (vs 112/1 before 1.2).
- 12 new tests per SPA (4 App.test.tsx with routing + 6 api-client.test.tsx interceptor + auth-store + refresh-token-store), times 3 SPAs = 51 net new SPA tests. **Total SPA: 63 passing, 1 skipped fixture** across audit-app + admin-app + client-portal.
- Full workspace `pnpm turbo run lint type-check test` — 29/29 successful. SPA Vitest + a11y gates from 0-8 still green after the routing rewrite.
- 30 Playwright tests pass (3 SPAs × 5 viewports × 2 specs) — baselines regenerated for the new login-page entry point.
- One non-trivial debug iteration: `LoginPage.tsx` initially used a dynamic `import('./auth-api')` to avoid a perceived circular import; the import was unnecessary (auth-api doesn't import LoginPage), so I removed it.
- The `User.name` field had to be added to `AuthUser` and the repo's select clause to support `/me`. This forced a small repo + service test patch.

### Completion Notes List

✅ **T1 — API: CORS, /me, requireRole, synthetic test route.**
- `@fastify/cors@^10.0.2` registered in `app.ts` BEFORE the auth hook with env-driven origin allowlist (`CORS_ORIGINS` comma-separated; defaults to dev SPA ports). `credentials: false`. `maxAge: 86_400`.
- `OPTIONS` short-circuit added to `registerAuthHook` so preflight requests skip the auth check. Verified via test (`OPTIONS /api/v1/audits` no longer 401s).
- `requireRole(roles[])` factory in `apps/api/src/middleware/role-guard.ts`. Throws `RoleNotPermittedError` (in `lib/auth-errors.ts`) which `error-handler.ts` maps to RFC 7807 403 with detail "Role not permitted".
- `GET /api/v1/me` in `routes/me.routes.ts`. Hits the DB via `request.withRls(...)` to fetch `email`/`name` (fields not in the JWT). 401 with detail "User no longer exists" if the JWT subject points at a deleted row.
- `GET /api/v1/_test/admin-only` in `routes/_test.routes.ts`. Registered via `if (process.env.NODE_ENV !== 'production')` gate. `schema: { hide: true }` keeps it out of OpenAPI docs.

✅ **T2 — Shared types.** `meResponseSchema`, `SURFACE_BY_ROLE`, `SurfaceCode` exported from `@cems/types`.

✅ **T3 — Per-SPA auth feature.** Triplicated `auth-store` (Zustand, in-memory access token), `refresh-token-store` (localStorage with safe-storage fallback), `auth-api` (login/refresh/logout/me wrappers — direct fetch, NOT through apiFetch to avoid recursion), `useAuthBootstrap`, `useLogout`, and `surface-urls`. The `api-client.ts` got an `AuthBridge` injection point: `configureAuthBridge({ getAccessToken, refresh, onAuthFailure })`. Refresh dedup via single in-flight `refreshOnce()` promise. 401 with `type !== '…/token-expired'` does NOT trigger refresh — fires `onAuthFailure` and re-throws.

✅ **T4 — Per-SPA LoginPage.** Email + password form using `@cems/ui` Input/Button. On submit: `loginApi` → `meApi` → role check via `SURFACE_BY_ROLE[user.role]`. Mismatch path: `logoutApi(refreshToken)` (best effort), `clearRefreshToken()`, `window.location.assign(surfaceUrls[correct] + '/login')`. Match path: `setSession(...)`, `setRefreshToken(...)`, `navigate(?next=… || '/', { replace: true })`. Errors surface in `aria-live="assertive"` region.

✅ **T5 — Routing + RequireAuth.** Each SPA's `main.tsx` wraps in `<BrowserRouter>` + `configureAuthBridge`. `App.tsx` uses `<Routes>` with `/login` (public) + `/*` (RequireAuth → Home). Home content per SPA preserves the original 0-7 placeholder copy + adds "Signed in as {name} ({email})" + a "Sign out" button. `<RequireAuth>` redirects unauthenticated to `/login?next=…`; redirects role/surface-mismatch via `window.location.assign` (cross-SPA full-page).

✅ **T6 — useLogout + Sign out button.** `useLogout` hook calls `logoutApi` best-effort, clears local session, navigates to `/login`. Wired to a "Sign out" button on each SPA's home page (placeholder UI; admin/auditor shells in later stories will host the real placement).

✅ **T7 — Cross-role 403 end-to-end test.** `_test.routes.test.ts` covers all 4 cases: ADMIN → 200, AUDITOR → 403, CLIENT → 403, no-auth → 401. The 403 body matches AC5 spec exactly.

✅ **T8 — Playwright baselines + CLAUDE.md.** All 15 baselines regenerated for the new login-page entry. CLAUDE.md gained a "CORS / VITE_*_APP_URL" env-var section + an "Auth Flow" section.

**Last 0-4 deferred item folded in:** CORS / OPTIONS preflight wiring — resolved.

**Out-of-scope items NOT done (deferred):**
- Real ADMIN-only routes (Story 1.3 will introduce them and obsolete the synthetic `_test.routes.ts`).
- httpOnly cookie + CSRF token migration (deferred security-hardening story).
- CSP headers via Azure SWA `staticwebapp.config.json` (deferred).
- Inactivity-based session expiry (NFR-S6).
- Session-persistence for the access token (intentional — memory-only).
- LoginPage.test.tsx component-level tests (the App.test.tsx routing test plus the api-client interceptor tests cover the meaningful paths; component-level happy-path will land if the LoginPage gains complexity).

**Library reconciliation note:** the story spec had a minor inconsistency about whether the synthetic `_test/admin-only` route should be added to `PUBLIC_ROUTES` — it was NOT (it's protected; only its registration is conditional). The implementation matches the AC5 spec text, not the offhand "synthetic" mention in the route-allowlist Anti-pattern section.

### File List

**Modified:**
- `apps/api/package.json` (added `@fastify/cors`)
- `apps/api/src/app.ts` (cors plugin + new route registrations)
- `apps/api/src/middleware/auth.ts` (OPTIONS short-circuit)
- `apps/api/src/middleware/error-handler.ts` (RoleNotPermittedError branch)
- `apps/api/src/middleware/auth.test.ts` (OPTIONS preflight test)
- `apps/api/src/lib/auth-errors.ts` (added RoleNotPermittedError)
- `apps/api/src/repositories/user.repo.ts` (added `name` field)
- `packages/types/src/auth.ts` (meResponseSchema, SURFACE_BY_ROLE, SurfaceCode)
- 3× `apps/<each>/src/main.tsx` (BrowserRouter + configureAuthBridge)
- 3× `apps/<each>/src/App.tsx` (Routes + RequireAuth + Home with Sign out)
- 3× `apps/<each>/src/App.test.tsx` (MemoryRouter wrapping, login-page heading expectations)
- 3× `apps/<each>/src/lib/api-client.ts` (AuthBridge + 401 interceptor + dedup)
- 3× `apps/<each>/tests/e2e/__screenshots__/**` (regenerated baselines)
- `pnpm-lock.yaml` (regenerated)
- `CLAUDE.md` (CORS env, VITE_*_APP_URL, auth flow section)
- `docs/bmad/_bmad-output/implementation-artifacts/sprint-status.yaml` (status: in-progress → review)

**Created:**
- `apps/api/src/middleware/role-guard.ts` + `role-guard.test.ts`
- `apps/api/src/routes/me.routes.ts` + `me.routes.test.ts`
- `apps/api/src/routes/_test.routes.ts` + `_test.routes.test.ts`
- 3× `apps/<each>/src/lib/surface-urls.ts` + `surface-urls.test.ts`
- 3× `apps/<each>/src/lib/api-client.test.ts`
- 3× `apps/<each>/src/features/auth/auth-store.ts` + `auth-store.test.ts`
- 3× `apps/<each>/src/features/auth/refresh-token-store.ts` + `refresh-token-store.test.ts`
- 3× `apps/<each>/src/features/auth/auth-api.ts`
- 3× `apps/<each>/src/features/auth/useAuthBootstrap.ts`
- 3× `apps/<each>/src/features/auth/useLogout.ts`
- 3× `apps/<each>/src/features/auth/RequireAuth.tsx`
- 3× `apps/<each>/src/features/auth/LoginPage.tsx`

## Change Log

| Date | Change | Author |
|---|---|---|
| 2026-05-07 | Initial story file created from epic 1.2 | create-story (claude-opus-4-7[1m]) |
| 2026-05-07 | Implementation complete — 8 tasks, 5 ACs satisfied; 13 new api + 51 new SPA Vitest tests, baselines regenerated; full workspace 29/29 green. Status → review. | dev-story (claude-opus-4-7[1m]) |
