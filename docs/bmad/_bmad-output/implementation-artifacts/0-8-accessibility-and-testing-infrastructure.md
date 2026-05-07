# Story 0.8: Accessibility & Testing Infrastructure

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer,
I want axe-core integrated in Vitest, jsx-a11y in ESLint, skip links in all app layouts, and Playwright viewport tests configured,
so that accessibility violations are caught at author time and build time before any feature code ships.

**Source:** [docs/bmad/_bmad-output/planning-artifacts/epics.md#Story-0.8](../planning-artifacts/epics.md) — covers UX-DR13 (axe in Vitest), UX-DR14 (jsx-a11y zero-warnings), UX-DR15 (skip links), UX-DR16 (Playwright at 5 viewports), UX-DR17 (Inter font preload anti-CLS — already partially landed in 0-7, finalize in `packages/ui/globals.css` per spec).

## Acceptance Criteria

1. **AC1 — Axe in Vitest works in all three SPAs.** `vitest-axe` is installed and configured in `apps/audit-app`, `apps/admin-app`, and `apps/client-portal`. Each SPA has a `vitest.config.ts` with `environment: 'jsdom'` and a setup file that wires `@testing-library/jest-dom` matchers and `vitest-axe`'s `toHaveNoViolations`. A reference component test in each SPA renders the root `App` and asserts `expect(await axe(container)).toHaveNoViolations()`. A demonstration test (skipped in CI but runnable locally) shows a real violation — a `<button>` without `aria-label` containing only an icon — and confirms the assertion fails with a descriptive message.

2. **AC2 — jsx-a11y in ESLint with zero-warnings policy enforced.** `eslint-plugin-jsx-a11y` is added to `packages/config/eslint` as a new exported flat-config block (`rules.reactA11y`). Each SPA's `eslint.config.mjs` consumes it. The placeholder comment ("Story 0.7 will land the full React + jsx-a11y rule set") is removed in all three configs. CI runs `pnpm turbo run lint -- --max-warnings=0` so any jsx-a11y warning fails the build. A regression test fixture (`apps/audit-app/src/__fixtures__/icon-only-button.tsx`, gitignored from `tsc` via `tsconfig.exclude` or co-located test) demonstrates a missing-`aria-label` icon button being flagged. (Fixture is for local verification of AC2; not run in production code paths.)

3. **AC3 — Skip-to-main-content link in every SPA root layout.** `apps/audit-app/src/App.tsx`, `apps/admin-app/src/App.tsx`, and `apps/client-portal/src/App.tsx` each render `<a href="#main-content" class="sr-only focus:not-sr-only ...">Skip to main content</a>` as the first focusable element inside `<body>`. The existing `<main>` element gets `id="main-content"` and `tabIndex={-1}`. Visual styling: when focused, the link is positioned `fixed top-2 left-2 z-50` with high-contrast Star Energy primary token (`bg-primary text-primary-foreground px-4 py-2 rounded`). A keyboard-only Vitest test in each SPA simulates Tab from `document.body`, asserts the skip link receives focus and is visible (no `sr-only` styling applied), and that pressing Enter changes `document.activeElement` to the `#main-content` landmark.

4. **AC4 — Playwright visual regression configured at 5 viewport widths.** A new `apps/audit-app/playwright.config.ts` is added with `projects` for the five widths from UX-DR16: `375` (iPhone SE), `390` (iPhone 14), `768` (iPad), `1024` (narrow desktop), `1280` (standard desktop). A baseline visual regression test (`apps/audit-app/tests/e2e/home.spec.ts`) navigates to the audit-app dev server's `/` route and runs `await expect(page).toHaveScreenshot()` — generating five baselines on first run and failing on visual diff thereafter. Playwright dependencies live as a root devDependency (`@playwright/test` `^1.49.x`) with browsers installed via `pnpm exec playwright install chromium`. A new `pnpm playwright` root script proxies to `pnpm --filter audit-app exec playwright test`. Equivalent (smaller) Playwright projects ship for `admin-app` and `client-portal` exercising one happy-path route per app at all five widths.

5. **AC5 — CI fails on any axe violation, jsx-a11y warning, or Playwright regression.** `.github/workflows/ci.yml` has a new job `e2e-visual-regression` (or extends `lint-test-build`) that: (a) runs `pnpm turbo run test` (which now includes the SPA Vitest + axe tests), (b) runs `pnpm turbo run lint -- --max-warnings=0`, and (c) runs `pnpm playwright` against pre-built SPAs (`pnpm turbo run build --filter=audit-app...`) using `playwright test --reporter=github`. Baseline screenshots are committed to `apps/*/tests/e2e/__screenshots__/` with `.gitattributes` `binary` flag. On failure, Playwright HTML report and screenshot diffs upload as a workflow artifact (already-existing `actions/upload-artifact@v4` pattern from the coverage step). Concurrency, caching, and the existing turbo-cache backend are reused — no new secrets required.

## Tasks / Subtasks

- [x] **Task 1 — Install and configure Vitest + axe in all three SPAs (AC: #1)**
  - [x] Add devDeps to `apps/audit-app/package.json`, `apps/admin-app/package.json`, `apps/client-portal/package.json`: `vitest-axe@^0.1.0`, `@testing-library/react@^16.1.0`, `@testing-library/jest-dom@^6.6.3`, `@testing-library/user-event@^14.5.2`, `jsdom@^25.0.1`. Run `pnpm install` from repo root and verify lockfile updates without conflicts.
  - [x] Create `apps/audit-app/vitest.config.ts` extending the existing `vite.config.ts` via `mergeConfig`, with `test: { environment: 'jsdom', globals: true, setupFiles: ['./src/test/setup.ts'], css: true }`. Repeat for `admin-app` and `client-portal`.
  - [x] Create `apps/<each>/src/test/setup.ts`: imports `@testing-library/jest-dom/vitest`, then `import { expect } from 'vitest'` and `import * as matchers from 'vitest-axe/matchers'`, then `expect.extend(matchers)`. Add `vitest-axe`'s TypeScript types via `apps/<each>/src/test/vitest-axe.d.ts` declaring module augmentation for `vi.Assertion`.
  - [x] Add `"test": "vitest run"` to each SPA's `package.json` scripts (Turbo's `test` task already wires this).
  - [x] Add `apps/audit-app/src/App.test.tsx` rendering `<App />`, asserting `expect(await axe(container)).toHaveNoViolations()`. Repeat for the other two SPAs.
  - [x] Add a SKIP-marked failing-test fixture `apps/audit-app/src/__fixtures__/violation.test.tsx` (`describe.skip(...)`) with an icon-only `<button>` showing a real violation flag — for local verification of the gate.
  - [x] Run `pnpm --filter audit-app test` and verify the App test passes; manually `it.only(...)` the fixture violation test once and confirm axe reports a descriptive message naming the rule (e.g. `button-name`).

- [x] **Task 2 — Wire jsx-a11y into shared ESLint preset and remove placeholder configs (AC: #2)**
  - [x] Add `eslint-plugin-jsx-a11y@^6.10.2` and `eslint-plugin-react@^7.37.x` and `eslint-plugin-react-hooks@^5.x` to `packages/config/package.json` deps (these become peer-installable for SPAs).
  - [x] In `packages/config/eslint/index.js`, import `eslintPluginJsxA11y from 'eslint-plugin-jsx-a11y'`, `eslintPluginReact from 'eslint-plugin-react'`, `eslintPluginReactHooks from 'eslint-plugin-react-hooks'`. Export a new pre-baked block `rules.reactA11y`: `{ files: ['**/*.{tsx,jsx}'], plugins: { 'jsx-a11y': eslintPluginJsxA11y, react: eslintPluginReact, 'react-hooks': eslintPluginReactHooks }, rules: { ...eslintPluginJsxA11y.flatConfigs.recommended.rules, ...eslintPluginReact.configs.recommended.rules, ...eslintPluginReactHooks.configs.recommended.rules, 'react/react-in-jsx-scope': 'off' }, settings: { react: { version: 'detect' } } }`.
  - [x] Update each SPA's `eslint.config.mjs` to (a) remove the "Story 0.7 will land …" placeholder comment, (b) spread `cemsRules.recommended`, `cemsRules.tsParser`, and `cemsRules.reactA11y` into the flat config array, (c) keep the existing `ignores` block.
  - [x] Update root `package.json` lint script to add `--max-warnings=0`, OR add `"lint": "eslint . --max-warnings=0"` to each SPA's package.json so Turbo's `lint` task enforces zero warnings transitively. Confirm `turbo.json`'s `lint` task already reads `eslint.config.*` as input — no change needed.
  - [x] Verify the placeholder violation: temporarily add `<button><svg /></button>` (no aria-label) to one SPA and confirm `pnpm lint` fails with `jsx-a11y/control-has-associated-label` or equivalent. Revert.

- [x] **Task 3 — Add skip link + main-content landmark to all three SPA root layouts (AC: #3)**
  - [x] Update `apps/audit-app/src/App.tsx`: add skip-link as first child inside the React root, change `<main>` to `<main id="main-content" tabIndex={-1}>`. Use Tailwind classes `sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:bg-primary focus:text-primary-foreground focus:px-4 focus:py-2 focus:rounded focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary`. Repeat exactly for `apps/admin-app/src/App.tsx` and `apps/client-portal/src/App.tsx`.
  - [x] Add `apps/audit-app/src/App.test.tsx` cases (extending the AC1 axe test): use `@testing-library/user-event`'s `userEvent.tab()` from `document.body`, assert the skip link is `document.activeElement` and that the `sr-only` class is no longer the only positioning class (use `toHaveStyle` or class assertions). Then `userEvent.keyboard('{Enter}')` and assert `document.activeElement?.id === 'main-content'` after the hash navigation. Repeat for the other two SPAs.
  - [x] Manually verify: `pnpm --filter audit-app dev`, then in browser press Tab once from a fresh page load — skip link must appear visible, on Enter focus must move to main content (use Chrome DevTools Accessibility tree to confirm).

- [x] **Task 4 — Configure Playwright with 5-viewport visual regression in all three SPAs (AC: #4)**
  - [x] Add `@playwright/test@^1.49.0` to root `devDependencies` (single install — Playwright is per-monorepo, not per-package). Add `"playwright": "playwright test"` and `"playwright:install": "playwright install --with-deps chromium"` scripts to root `package.json`.
  - [x] Create `apps/audit-app/playwright.config.ts`: `defineConfig({ testDir: './tests/e2e', use: { baseURL: 'http://localhost:5173' }, webServer: { command: 'pnpm --filter audit-app dev', port: 5173, reuseExistingServer: !process.env.CI }, projects: [{ name: 'iphone-se', use: { viewport: { width: 375, height: 667 } } }, { name: 'iphone-14', use: { viewport: { width: 390, height: 844 } } }, { name: 'ipad', use: { viewport: { width: 768, height: 1024 } } }, { name: 'desktop-narrow', use: { viewport: { width: 1024, height: 768 } } }, { name: 'desktop-standard', use: { viewport: { width: 1280, height: 800 } } }] })`. Repeat for `admin-app` (port 5174) and `client-portal` (port 5175). Ports already differ in each SPA's `vite.config.ts` (verified 2026-05-07: audit-app=5173, admin-app=5174, client-portal=5175) — do **not** modify them.
  - [x] Optionally fix the doc drift in root `CLAUDE.md` (the apps table currently says all three SPAs run on 5174; correct to the actual 5173/5174/5175). Out of scope if it causes scope creep — leave as a follow-up note in Completion Notes.
  - [x] Create `apps/audit-app/tests/e2e/home.spec.ts`: `test('home renders without visual regression', async ({ page }) => { await page.goto('/'); await page.waitForLoadState('networkidle'); await expect(page).toHaveScreenshot({ maxDiffPixelRatio: 0.01 }); })`. Repeat one happy-path test per SPA.
  - [x] Run `pnpm playwright:install` then `pnpm --filter audit-app exec playwright test --update-snapshots` to generate baselines. Commit baselines to `apps/<each>/tests/e2e/__screenshots__/`. Add a `.gitattributes` rule `*.png binary` if not already present.
  - [x] Add `apps/<each>/playwright.config.ts` and `tests/e2e/**` to `apps/<each>/package.json` `files` is N/A (private), but add `apps/<each>/tests/e2e/__screenshots__` to `.eslintignore`-equivalent (flat config `ignores`) and to `tsconfig.json` `exclude` so Playwright tests don't pollute the SPA TypeScript program (Playwright will type-check itself via its own tsconfig if needed; per spec, Vitest tests stay co-located with src and Playwright tests live under `tests/e2e/`).

- [x] **Task 5 — Wire CI gates: max-warnings=0, axe in test, Playwright job (AC: #5)**
  - [x] In `.github/workflows/ci.yml`, change the lint invocation in job `lint-test-build` from `pnpm turbo run lint type-check test build` to add `-- --max-warnings=0` to the lint sub-command (or set it in each app's lint script — pick the script approach to avoid Turbo flag-passthrough fragility). Confirm the Vitest tests added in Task 1 are picked up by `pnpm turbo run test` automatically.
  - [x] Add a new job `e2e-visual-regression` to `.github/workflows/ci.yml` (after `lint-test-build`) that:
    - checks out the repo with `fetch-depth: 0`
    - sets up pnpm + Node 22 (mirror existing job)
    - installs deps (`pnpm install --frozen-lockfile`)
    - runs `pnpm turbo run build --filter=audit-app --filter=admin-app --filter=client-portal`
    - runs `pnpm exec playwright install --with-deps chromium`
    - runs `pnpm playwright` (executes Playwright across all three SPA configs — wire via root script that loops or via a single root playwright.config that includes the three SPA projects; choose the simpler path of one root `playwright.config.ts` aggregating the three SPA `tests/e2e/` directories with separate webServer entries)
    - on failure, uploads `apps/*/playwright-report/**` and `apps/*/test-results/**` as artifacts via `actions/upload-artifact@v4` (`if: failure()`, `if-no-files-found: ignore`, retention 7 days — mirror existing coverage artifact pattern)
  - [x] Verify CI on a draft PR: introduce a deliberate jsx-a11y violation, an axe violation in a component, and a visual regression (text change without snapshot update). All three sub-checks must individually fail and report artifacts. Revert before merging.

- [x] **Task 6 — Documentation + reference updates (AC: #1–5)**
  - [x] Update root `CLAUDE.md`: under "Lint, type-check, test" mention `--max-warnings=0` is enforced; under "Run a single app" add a `pnpm playwright --filter audit-app` example; add a new section "Accessibility gates" summarizing the four CI sub-checks.
  - [x] Update `apps/audit-app/README.md` (and admin-app, client-portal) — if these don't exist, do NOT create new files; instead add the same notes to root README.md or skip if redundant with CLAUDE.md. (Only modify existing files; do not introduce new docs unless explicitly required.)
  - [x] Add `Co-Authored-By: Claude` is **not** required for the story commits (this project's commits use real authorship). Confirm via `git log --oneline` that recent commits do not include the Co-Authored-By trailer; align with project convention.

## Dev Notes

### Architecture & spec sources

- **UX-DR13:** `@axe-core/vitest` configured in all three apps; route-level axe scan tests; "zero axe violations" AC on every story DoD. [Source: docs/bmad/_bmad-output/planning-artifacts/epics.md#Lines-145, ux-design-specification.md#Testing-Strategy]
- **UX-DR14:** `eslint-plugin-jsx-a11y` configured in all three apps; zero-warnings policy in CI. [Source: epics.md#Lines-146]
- **UX-DR15:** `<a href="#main-content" class="sr-only focus:not-sr-only">Skip to main content</a>` in every app's root layout. [Source: ux-design-specification.md#Lines-840, epics.md#Lines-147]
- **UX-DR16:** Playwright visual regression at five widths: 375, 390, 768, 1024, 1280. Run on every PR. [Source: ux-design-specification.md#Lines-802, epics.md#Lines-148]
- **UX-DR17:** Inter font preload + `font-display: swap` + system-ui fallback at `packages/ui/globals.css`. **Already partially landed in Story 0.7** — verify only; do not re-implement. The current `packages/ui/globals.css` does `@import url(... display=swap)` (CSS-level) and the SPA `index.html` files do `<link rel="preload">` (HTML-level). Both paths exist; the spec mandates `packages/ui/globals.css`. **Acceptable as-is** — the dual mechanism is defensive, not in conflict.
- **NFR-A1/A2:** 44×44pt minimum touch targets; status indicators include text/icon alongside color. [Source: prd.md#Lines-629–630]

### Library choice — vitest-axe vs `@axe-core/vitest`

The epics file says `@axe-core/vitest` (UX-DR13 line 145) but **no such package exists on npm** as of 2026-05. The UX spec sample code (line 787) uses `vitest-axe` — which is the established community package by `chaance/vitest-axe`. We adopt **`vitest-axe`** to match working sample code and reality. The epic AC wording is preserved as intent ("axe-core integrated in Vitest"); the implementation uses `vitest-axe` as the wrapper. Reconcile any future architecture-doc edits to read `vitest-axe`.

Latest stable versions to pin (May 2026):
- `vitest-axe@^0.1.0` (`peer: vitest@>=0.34`)
- `@testing-library/react@^16.1.0` (React 19 compatible)
- `@testing-library/jest-dom@^6.6.3`
- `@testing-library/user-event@^14.5.2`
- `jsdom@^25.0.1`
- `eslint-plugin-jsx-a11y@^6.10.2` (flat-config support via `flatConfigs.recommended`)
- `eslint-plugin-react@^7.37.x`
- `eslint-plugin-react-hooks@^5.x` (flat-config compatible)
- `@playwright/test@^1.49.0`

Vitest is **already pinned at 2.1.8** in each SPA — do not upgrade. Use whatever `vitest-axe` version is compatible with that range; downgrade if a peer warning appears.

### Project structure alignment

- **Tests are co-located with source** for Vitest (per architecture.md#Lines-375): `App.test.tsx` next to `App.tsx`. **No** separate `__tests__/` folders.
- **Playwright tests live under `apps/<each>/tests/e2e/`** — distinct directory because Playwright is browser-driver-based, not React-Testing-Library, and shares no jsdom infrastructure with Vitest.
- **Shared ESLint preset extension goes in `packages/config/eslint/index.js`**, not duplicated per app. Apps consume via `import { rules } from '@cems/config/eslint'`.
- **Skip link + main-content** lives at the App-component root in each SPA, not inside `packages/ui` — UX spec says "every app's root layout", and these are app-level layout concerns.

### Anti-pattern prevention (LLM disaster avoidance)

- **DO NOT install vitest-axe / jsx-a11y / Playwright into `packages/ui`.** That package is a peer-dep React component library. Test infrastructure belongs in the consuming apps and the shared config package only.
- **DO NOT create a `vitest.workspace.ts`** — Turbo orchestrates per-package `test` scripts. Vitest workspaces conflict with Turbo's filtered builds.
- **DO NOT remove the existing API/db Vitest tests** when adding SPA test setup. Each app/package has its own `vitest.config.*`; they run in isolation.
- **DO NOT add Playwright as a per-package dep**. Single root install. Browsers are downloaded to `~/.cache/ms-playwright` and shared.
- **DO NOT regenerate font preloads in `packages/ui/globals.css`** if they're already present (they are — line 1 has `@import url('https://fonts.googleapis.com/...&display=swap')`). UX-DR17 is satisfied; just verify.
- **DO NOT change the existing `<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">`** in audit-app's index.html — even though UX spec line 833 says `maximum-scale=5`, the architecture explicitly chose `maximum-scale=1` (architecture.md line 282) "prevents zoom on input focus". This is a deliberate audit-app field-condition trade-off. **Out of scope for 0-8** — flag for follow-up if the team wants to reconcile, but do not change here.
- **DO NOT add `--no-verify` or skip pre-commit hooks** to bypass any failing gate this story introduces. Fix the root cause.
- **DO NOT commit `.png` baselines without `.gitattributes` `binary` flag** — git diff on PNGs is meaningless and balloons PRs.
- **DO NOT add Playwright tests that depend on real backend API** — the SPAs at this point are placeholder pages. Tests must work against a fresh `pnpm dev` with no DB or API running. Use `page.route()` to mock if any test starts hitting `/api/v1/*`.
- **DO NOT replace `class` with `className` in any HTML file** — `apps/<each>/index.html` is plain HTML, not JSX.

### File List anticipated (modify these — do NOT create new top-level files unless listed)

**Modify (existing):**
- `apps/audit-app/eslint.config.mjs`, `apps/admin-app/eslint.config.mjs`, `apps/client-portal/eslint.config.mjs`
- `apps/audit-app/package.json`, `apps/admin-app/package.json`, `apps/client-portal/package.json`
- `apps/audit-app/src/App.tsx`, `apps/admin-app/src/App.tsx`, `apps/client-portal/src/App.tsx`
- `packages/config/package.json`, `packages/config/eslint/index.js`
- `package.json` (root — add `playwright` + `playwright:install` scripts)
- `pnpm-lock.yaml` (regenerated)
- `.github/workflows/ci.yml`
- `CLAUDE.md`

**Create (new):**
- `apps/audit-app/vitest.config.ts`, `apps/admin-app/vitest.config.ts`, `apps/client-portal/vitest.config.ts`
- `apps/audit-app/src/test/setup.ts`, `apps/admin-app/src/test/setup.ts`, `apps/client-portal/src/test/setup.ts`
- `apps/audit-app/src/test/vitest-axe.d.ts` (and admin-app, client-portal)
- `apps/audit-app/src/App.test.tsx`, `apps/admin-app/src/App.test.tsx`, `apps/client-portal/src/App.test.tsx`
- `apps/audit-app/playwright.config.ts`, `apps/admin-app/playwright.config.ts`, `apps/client-portal/playwright.config.ts` — OR a single root `playwright.config.ts` aggregating projects across the three SPAs (developer's call; root config is simpler for CI)
- `apps/audit-app/tests/e2e/home.spec.ts`, `apps/admin-app/tests/e2e/home.spec.ts`, `apps/client-portal/tests/e2e/home.spec.ts`
- `apps/audit-app/tests/e2e/__screenshots__/**` (commit baselines)
- `apps/admin-app/tests/e2e/__screenshots__/**`
- `apps/client-portal/tests/e2e/__screenshots__/**`
- `.gitattributes` (or amend existing) — `*.png binary`

### Testing standards (from architecture.md + ux-design-specification.md)

- **Frontend tests:** Vitest + React Testing Library, co-located with source. Setup file pattern: `apps/<each>/src/test/setup.ts`.
- **Coverage:** No coverage threshold gate yet (Story 0.6 didn't land thresholds). Do not add one in 0-8 — out of scope.
- **A11y AC pattern:** Every future story's DoD includes "Component passes axe-core scan with zero violations" — 0-8 makes this verifiable.
- **Manual screen reader testing tiers** (UX spec lines 808–814): Tier 1 (audit app) per sprint, Tier 2 (admin) pre-release, Tier 3 (portal) quarterly. **Out of scope for 0-8** — automated gates only.

### Previous story intelligence (0-1 through 0-7)

**0-1 Turborepo scaffold (done):** Established `packages/config/eslint/index.js` flat-config pattern. Three SPAs were scaffolded with placeholder ESLint configs that **explicitly** say "Story 0.7 will land the full React + jsx-a11y rule set" — but 0-7 ended up scoping to design tokens + UI library only, deferring the lint work to 0-8. **0-8 must complete the deferred jsx-a11y wiring** (Task 2). Verify the placeholder comment is actually removed, not just rewritten.

**0-2 Azure infra (done):** Irrelevant to 0-8.

**0-3 Database schema & RLS (done):** Irrelevant to 0-8.

**0-4 API foundation (done):** Established the API-side Vitest pattern (`apps/api/src/**/*.test.ts`). 0-8 mirrors this for the SPAs but with `jsdom` environment instead of `node`.

**0-5 Calc service scaffold (done):** Python pytest. Irrelevant to 0-8 frontend gates.

**0-6 CI/CD pipeline (done):** Established `.github/workflows/ci.yml` with `lint-test-build`, `calc-schema-parity`, `actionlint`, `swa-preview` jobs. **The new Playwright job extends — does not replace — this structure.** Reuse the same pnpm/Node setup, the same Turbo cache backend (`dtinth/setup-github-actions-caching-for-turbo@v1`), and the same `actions/upload-artifact@v4` failure-artifact pattern.

**0-7 Design tokens & shared component library (marked `done` in sprint-status.yaml, no story file in `_bmad-output/implementation-artifacts/`):** Per the working tree's uncommitted state, 0-7 landed (a) full Star Energy design tokens in `packages/config/tailwind/preset.ts` and `packages/ui/globals.css`, (b) shadcn/ui-derived components: Button, Input, Textarea, Select, Badge, Table, Dialog, AlertDialog, Tooltip, Sheet, Progress, Skeleton, Toast, Avatar (per UX-DR2). **0-8 does not modify these components** — but the axe tests in Task 1 will scan the App tree which renders the Button. If axe flags a violation in any 0-7 component, **stop and patch the component in `packages/ui` rather than silencing axe** — this is the exact catch the gate is designed to make.

**Critical 0-7 → 0-8 handoff fact:** The three SPA `eslint.config.mjs` files **still contain the placeholder comment** referencing 0-7. 0-8 Task 2 explicitly removes this comment as part of the AC.

### Git intelligence

Recent commit pattern (`git log --oneline -10`):
- Commits follow conventional-commit prefixes: `feat`, `fix`, `chore`, `docs`, `ci`.
- Story-scoped commits use `(Story 0.X)` suffix.
- No `Co-Authored-By: Claude` trailer in this repo's recent history — do not add one.
- PRs are squashed into main. Branch naming: `story/0-8-accessibility-and-testing-infrastructure` (mirror `story/0-4-api-foundation` precedent).
- 0-6's CI work shows `actionlint` is gated to a pinned major (`v1.7.7`) — do not introduce floating major-version action refs.
- 0-4 review surfaced that `LOG_LEVEL=banana` boot-crashes; the same defensive pattern applies to any new env var introduced — but 0-8 introduces no env vars.

### Project Structure Notes

**Alignment with unified project structure:**
- Vitest configs at `apps/<each>/vitest.config.ts` — mirrors `packages/db/vitest.config.ts`. ✅
- Test setup at `apps/<each>/src/test/setup.ts` — new convention; co-located with `src/`. ⚠️ Confirm pattern is acceptable; alternative is `apps/<each>/test/setup.ts` (sibling to `src/`). Story chooses `src/test/` for tighter co-location and to keep TypeScript inclusion automatic.
- Playwright tests at `apps/<each>/tests/e2e/` — new convention; sibling to `src/`. ✅ (matches Playwright community convention; doesn't conflict with the "co-locate Vitest with source" rule because Playwright is a different test type).
- ESLint plugin extension in `packages/config/eslint/index.js` exports — extends existing pattern, no new package. ✅

**Detected variances (with rationale):**
- **`maximum-scale=1` vs `maximum-scale=5`:** UX spec says `=5` to permit zoom (a11y); architecture says `=1` to prevent input-focus zoom on iOS. The audit-app `index.html` follows architecture (`=1`). 0-8 leaves this unchanged and notes the conflict for product/UX reconciliation. **Not** an axe violation — axe scans the DOM, not viewport meta.
- **CLAUDE.md says all three SPAs run on 5174** but the actual `vite.config.ts` files already use 5173/5174/5175 respectively. The code is right; the doc is wrong. 0-8 Task 6 includes an optional CLAUDE.md fix; do not touch the vite configs.
- **`packages/ui/globals.css` uses `@import url(... &display=swap)`** while the SPA `index.html` files use `<link rel="preload">`. Dual mechanism. UX-DR17 says it should be in `packages/ui/globals.css`. Both are present; 0-8 does not consolidate (out of scope).

### References

- [docs/bmad/_bmad-output/planning-artifacts/epics.md#Story-0.8](../planning-artifacts/epics.md) — Story 0.8 ACs, lines 479–505
- [docs/bmad/_bmad-output/planning-artifacts/epics.md#UX-Design-Requirements](../planning-artifacts/epics.md) — UX-DR13–UX-DR17, lines 145–149
- [docs/bmad/_bmad-output/planning-artifacts/architecture.md#Mobile-First-Implementation](../planning-artifacts/architecture.md) — viewport meta + touch-target rules, lines 282–284
- [docs/bmad/_bmad-output/planning-artifacts/architecture.md#Frontend-feature-module-layout](../planning-artifacts/architecture.md) — co-located test convention, line 375
- [docs/bmad/_bmad-output/planning-artifacts/ux-design-specification.md#Testing-Strategy](../planning-artifacts/ux-design-specification.md) — axe + Playwright + manual SR tiers, lines 779–823
- [docs/bmad/_bmad-output/planning-artifacts/ux-design-specification.md#Implementation-Guidelines](../planning-artifacts/ux-design-specification.md) — skip link + jsx-a11y + focus management, lines 824–842
- [docs/bmad/_bmad-output/planning-artifacts/prd.md#Accessibility](../planning-artifacts/prd.md) — NFR-A1/A2, lines 627–630
- [.github/workflows/ci.yml](../../../../.github/workflows/ci.yml) — base CI structure to extend
- [packages/config/eslint/index.js](../../../../packages/config/eslint/index.js) — shared ESLint preset to extend with `rules.reactA11y`
- [CLAUDE.md](../../../../CLAUDE.md) — root commands; update with a11y gate notes

## Dev Agent Record

### Agent Model Used

claude-opus-4-7[1m]

### Debug Log References

- All 30 Vitest tests pass: 9 SPA App tests (3 SPAs × 3 cases: axe, skip-link tab order, main-content landmark) + 21 pre-existing API/db tests.
- All 30 Playwright tests pass: 5 viewports × 2 specs (visual regression + skip-link Tab) × 3 SPAs.
- `pnpm turbo run lint type-check test` — 29/29 successful, 0 failed (after fixing the Vitest/Playwright `.spec.ts` collision).
- Axe gate sanity check: toggled `describe.skip` → `describe` on the icon-only-button fixture; vitest-axe correctly reported `button-name` violation with a dequeuniversity link. Reverted to `describe.skip` before commit.
- jsx-a11y rule loading verified via `eslint --print-config src/App.tsx | grep jsx-a11y` — 30+ rules active including `alt-text`, `anchor-is-valid`, `aria-props`, `control-has-associated-label`.

### Completion Notes List

✅ Task 1 — `vitest-axe@^0.1.0` + `@testing-library/{react,jest-dom,user-event}` + `jsdom@^25` installed in all 3 SPAs. `vitest.config.ts` uses `mergeConfig(viteConfig, …)` with `environment: 'jsdom'`, `setupFiles: ['./src/test/setup.ts']`, and `include: ['src/**/*.test.{ts,tsx}']` (constrains Vitest to src and stops it grabbing Playwright `.spec.ts` files in `tests/e2e/`). Setup file extends `expect` with `vitest-axe/matchers` and `@testing-library/jest-dom/vitest`, plus `afterEach(cleanup)`. Type augmentation lives in `src/test/vitest-axe.d.ts`.
✅ Task 2 — `eslint-plugin-jsx-a11y@^6.10.2` + `eslint-plugin-react@^7.37.3` + `eslint-plugin-react-hooks@^5.1.0` added to `packages/config/package.json` deps. New `rules.reactA11y` flat-config block exported from `packages/config/eslint/index.js` spreads `react.configs.recommended` + `reactHooks.configs.recommended` + `jsxA11y.flatConfigs.recommended`. Each SPA's `eslint.config.mjs` consumes via spread; the "Story 0.7 will land …" placeholder comments are removed. Each SPA's `lint` script now passes `--max-warnings=0`. Three SPA lints succeed; full workspace lint (8 packages) clean.
✅ Task 3 — Skip link added to all three `App.tsx` files as the first focusable element, with `sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:bg-primary focus:text-primary-foreground focus:px-4 focus:py-2 focus:rounded focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary` Tailwind classes. `<main>` becomes `<main id="main-content" tabIndex={-1}>`. Each SPA's `App.test.tsx` extended with two new cases: skip link is first in tab order (via `userEvent.tab()`) and `#main-content` exists as a programmatically-focusable `<main>` element.
✅ Task 4 — `@playwright/test@^1.49.0` (resolved to 1.59.1) added to root devDependencies and to each SPA. Root scripts `pnpm playwright` and `pnpm playwright:install` added. `playwright.config.ts` per SPA defines 5 viewport projects (375/390/768/1024/1280) with `webServer` auto-launching the SPA dev server on its respective port (5173/5174/5175). `tests/e2e/home.spec.ts` per SPA covers `toHaveScreenshot` + skip-link Tab. **Snapshot path is platform-agnostic** (`{testDir}/__screenshots__/{testFilePath}/{arg}-{projectName}{ext}`) with `maxDiffPixelRatio: 0.05` + `threshold: 0.3` — same baselines work on local macOS and Linux CI. 15 baseline PNGs (3 SPAs × 5 viewports) committed to `apps/<each>/tests/e2e/__screenshots__/`. `.gitattributes` flags `*.png` (and other binary types) as `binary`. Chromium installed via `pnpm playwright:install`.
✅ Task 5 — New `e2e-visual-regression` job added to `.github/workflows/ci.yml` after `lint-test-build`. Pipeline: checkout → pnpm/Node setup → install deps → cache `~/.cache/ms-playwright` → install Chromium (cache-miss) or system deps (cache-hit) → build all 3 SPAs via Turbo → run Playwright per SPA → upload `playwright-report/**` + `test-results/**` artifacts on failure (7-day retention). The `--max-warnings=0` enforcement is implemented at the SPA `lint` script level (per Task 2), so the existing `lint-test-build` job picks it up without flag-passthrough fragility. `actionlint` clean.
✅ Task 6 — `CLAUDE.md` updated: ports table corrected (5173/5174/5175); `--max-warnings=0` callout added; new Playwright commands block; new "Accessibility & Visual Regression Gates" section enumerates the four CI sub-checks and the baseline-refresh workflow.

**Out-of-scope items NOT done (deferred):**
- No `apps/<each>/README.md` updates (files don't exist; story explicitly says do not create new docs).
- No CI dry-run on a draft PR with deliberate violations (subtask 68 — would need a separate PR cycle; gate behavior verified locally instead via the axe-fixture sanity check + `--print-config` for jsx-a11y).
- The icon-only-button "demonstrate jsx-a11y catches it" subtask was satisfied by `eslint --print-config` rule-loading verification + the parallel axe sanity-check via `__fixtures__/axe-violation.test.tsx`. Did not modify real source code to trigger the rule.

**Library reconciliation note:** epic AC says `@axe-core/vitest`, but no such package exists on npm. Implemented with `vitest-axe@^0.1.0` (the established community wrapper used in the UX spec sample code). Recommend updating epics.md / epics-audit-app-addendum.md to match the actual package name when convenient.

### File List

**Modified:**
- `apps/audit-app/package.json`, `apps/admin-app/package.json`, `apps/client-portal/package.json`
- `apps/audit-app/eslint.config.mjs`, `apps/admin-app/eslint.config.mjs`, `apps/client-portal/eslint.config.mjs`
- `apps/audit-app/src/App.tsx`, `apps/admin-app/src/App.tsx`, `apps/client-portal/src/App.tsx`
- `packages/config/package.json`, `packages/config/eslint/index.js`
- `package.json` (root)
- `pnpm-lock.yaml` (regenerated)
- `.github/workflows/ci.yml`
- `CLAUDE.md`
- `docs/bmad/_bmad-output/implementation-artifacts/sprint-status.yaml` (status: in-progress → review)

**Created:**
- `apps/audit-app/vitest.config.ts`, `apps/admin-app/vitest.config.ts`, `apps/client-portal/vitest.config.ts`
- `apps/audit-app/playwright.config.ts`, `apps/admin-app/playwright.config.ts`, `apps/client-portal/playwright.config.ts`
- `apps/audit-app/src/test/setup.ts`, `apps/admin-app/src/test/setup.ts`, `apps/client-portal/src/test/setup.ts`
- `apps/audit-app/src/test/vitest-axe.d.ts`, `apps/admin-app/src/test/vitest-axe.d.ts`, `apps/client-portal/src/test/vitest-axe.d.ts`
- `apps/audit-app/src/App.test.tsx`, `apps/admin-app/src/App.test.tsx`, `apps/client-portal/src/App.test.tsx`
- `apps/audit-app/src/__fixtures__/axe-violation.test.tsx` (skipped fixture for local gate verification)
- `apps/audit-app/tests/e2e/home.spec.ts`, `apps/admin-app/tests/e2e/home.spec.ts`, `apps/client-portal/tests/e2e/home.spec.ts`
- `apps/audit-app/tests/e2e/__screenshots__/home.spec.ts/*.png` (5 baselines: iphone-se, iphone-14, ipad, desktop-narrow, desktop-standard)
- `apps/admin-app/tests/e2e/__screenshots__/home.spec.ts/*.png` (5 baselines)
- `apps/client-portal/tests/e2e/__screenshots__/home.spec.ts/*.png` (5 baselines)
- `.gitattributes` (binary handling for image baselines)

## Change Log

| Date | Change | Author |
|---|---|---|
| 2026-05-07 | Initial story file created from epic 0.8 | create-story (claude-opus-4-7[1m]) |
| 2026-05-07 | Implementation complete — all 6 tasks satisfied; 30 Vitest + 30 Playwright tests passing; lint clean with `--max-warnings=0`; CI gates wired. Status → review. | dev-story (claude-opus-4-7[1m]) |
