## Epic 0: Platform Foundation & Developer Infrastructure

The development team can build, test, and deploy all three applications. Azure infrastructure, shared packages, design tokens, and accessibility tooling are in place before any feature work begins.

**Requirements covered:** Arc-1 to Arc-21, UX-DR1, UX-DR2, UX-DR13–UX-DR17

---

### Story 0.1: Turborepo Monorepo & Shared Package Scaffold

As a developer,
I want a configured Turborepo monorepo with all app scaffolds and shared packages in place,
So that all three applications and the API can be developed in a consistent, type-safe environment with shared dependencies.

**Acceptance Criteria:**

**Given** the repository is cloned,
**When** `pnpm install` is run,
**Then** all workspace dependencies install without errors and all five apps + four packages resolve correctly

**Given** any app is targeted with `turbo run build --filter=audit-app`,
**When** the build runs,
**Then** only that app and its dependencies rebuild (Turborepo filtered build)

**Given** `packages/types` exports AuditStatus enum and all timing constants (SECTION_LOCK_TTL_MS=90000, HEARTBEAT_MS=30000, POLL_MS=15000, PHOTO_MAX_SIZE_BYTES=10MB),
**When** a type is imported in any app,
**Then** TypeScript resolves it without error

**Given** `packages/config/tailwind/preset.ts` is created,
**When** any app's tailwind.config.ts extends it,
**Then** all shared design tokens, breakpoints, and spacing scale are available

**Given** `packages/ui` exports a Button component,
**When** imported in any app,
**Then** it compiles and renders without error

---

### Story 0.2: Azure Infrastructure Provisioning

As a DevOps engineer,
I want all Azure services provisioned in Canada Central across dev/staging/prod environments,
So that applications have a deployment target with correct data residency, security isolation, and environment parity.

**Acceptance Criteria:**

**Given** Azure subscription is configured,
**When** infrastructure-as-code (Bicep/Terraform) is applied,
**Then** Azure SQL (S2), Redis (C0 dev / C1 prod), Blob Storage (LRS), Key Vault (Standard), App Service (B2), and Container Apps are created in Canada Central

**Given** dev, staging, and prod environments exist,
**When** switching between them,
**Then** each has fully isolated data, independent Redis instances, and separate Key Vault secrets

**Given** Azure Key Vault is provisioned,
**When** the application starts in any environment,
**Then** all secrets (DB connection string, JWT secret, API keys) are injected as runtime environment variables — no secrets in code or `.env` files committed to source control

**Given** Azure Blob Storage is provisioned,
**When** a test file is uploaded via the azure-blob.ts utility,
**Then** it is stored with LRS redundancy and accessible via time-limited SAS token

---

### Story 0.3: Database Schema & RLS Foundation

As a developer,
I want the complete Prisma schema initialized with all entities and RLS middleware enforcing tenant and role isolation on every query,
So that all application features have a secure, tenant-scoped data layer from day one with an immutable audit trail.

**Acceptance Criteria:**

**Given** Prisma schema is initialized in packages/db,
**When** `prisma migrate deploy` runs against Azure SQL,
**Then** all core tables are created: audits, audit_sections, users, user_sessions, compressor_refs, store_refs, section_locks, audit_log — with tenant_id on every entity table

**Given** a request arrives with a valid JWT,
**When** any Prisma query executes via the rls.ts middleware,
**Then** SESSION_CONTEXT('tenant_id'), SESSION_CONTEXT('user_id'), and SESSION_CONTEXT('user_role') are set before the query runs

**Given** Azure SQL RLS policies are applied to the audits table,
**When** a client-role user queries audits,
**Then** only rows where client_id matches their assigned store IDs are returned — no application-layer filter required

**Given** audit_log.repo.ts is created,
**When** appendLog() is called with a state transition event,
**Then** a row is inserted; the repository has no update() or delete() methods

**Given** `form_version` and `compressor_db_version` columns exist on the audits table,
**When** an audit row is created,
**Then** both fields accept string values and are non-nullable

---

### Story 0.4: Node.js API Foundation & Job Queue Setup

As a developer,
I want a running Fastify API with JWT auth middleware, RFC 7807 error handling, OpenAPI docs, structured logging, and BullMQ queues configured,
So that all feature routes have a consistent, observable, and testable foundation.

**Acceptance Criteria:**

**Given** the API server starts,
**When** GET `/api/v1/health` is called,
**Then** 200 OK is returned with `{ "status": "ok" }`

**Given** a route is called without a valid JWT,
**When** auth middleware runs,
**Then** response follows RFC 7807 format: `{ "type": "...authentication-required", "status": 401, "title": "Unauthorized" }`

**Given** any unhandled error is thrown in a route,
**When** the global error handler processes it,
**Then** the response always follows RFC 7807 format regardless of error type

**Given** `@fastify/swagger` is registered,
**When** GET `/api/v1/docs` is accessed,
**Then** an OpenAPI 3.0 spec is served listing all registered routes

**Given** a request completes,
**When** Pino logs the request,
**Then** the log line includes `tenant_id`, `user_id`, `route`, and `duration_ms` as structured JSON fields

**Given** BullMQ is configured with Redis,
**When** a job is enqueued on `cems:email-notification:low`,
**Then** it persists in Redis and a test worker can dequeue and process it

---

### Story 0.5: Python Calculation Service Scaffold

As a developer,
I want a running Python FastAPI calculation service deployed as an Azure Container App with internal-only VNet access,
So that the Node.js API can delegate calculation work via internal HTTP with a proper timeout and circuit breaker.

**Acceptance Criteria:**

**Given** the calc service starts,
**When** GET `/health` is called,
**Then** 200 OK is returned

**Given** POST `/calculate/ecm`, POST `/calculate/baseline`, and POST `/calculate/refrigerant` are implemented as stubs,
**When** called with valid Pydantic-validated input,
**Then** each returns 200 with a placeholder response matching the final response schema

**Given** the calc service is deployed to Azure Container Apps,
**When** the Node.js API calls `http://calc-service:8000/calculate/ecm` from within Azure VNet,
**Then** the request resolves — the service has no public URL

**Given** the calc service is unavailable or slow,
**When** the Node.js API calls it with a 30s timeout,
**Then** the call fails within 30 seconds and returns a defined error (does not hang indefinitely)

**Given** pytest runs in the calc service,
**When** tests execute,
**Then** all three stub endpoint tests pass

---

### Story 0.6: CI/CD Pipeline

As a developer,
I want GitHub Actions workflows for CI checks, staging deploy, and production deploy with manual approval gate,
So that every PR is automatically validated and merged code reaches staging without manual intervention.

**Acceptance Criteria:**

**Given** a PR is opened targeting main,
**When** the CI workflow runs,
**Then** `turbo run lint type-check test build --filter=[HEAD^1]` runs for changed packages and reports pass/fail per package

**Given** a PR is opened,
**When** CI passes,
**Then** an Azure Static Web Apps preview URL is generated and posted to the PR

**Given** code is merged to main,
**When** the staging deploy workflow runs,
**Then** all three frontend apps deploy to Azure Static Web Apps and the API deploys via App Service slot swap with zero downtime

**Given** staging deploy succeeds,
**When** the production workflow is triggered,
**Then** it halts at a manual approval gate and only proceeds after explicit approval

**Given** a package with no changes is part of the build,
**When** Turborepo Remote Cache has a previous build artifact,
**Then** that package's build step is skipped with a cache hit logged

---

### Story 0.7: Design Tokens & Shared Component Library

As a developer,
I want Star Energy design tokens in the shared Tailwind preset and shadcn/ui base components available in packages/ui,
So that all three applications can build pixel-consistent, on-brand UIs from a shared set of primitives.

**Acceptance Criteria:**

**Given** `packages/config/tailwind/preset.ts` is populated with all design tokens,
**When** any app extends the preset,
**Then** all CSS variables are available: `--color-primary: #1B6BDB`, `--color-success: #2E7D32`, `--color-warning: #F5A623`, `--color-danger: #DC2626`, all surface and text tokens

**Given** Inter is loaded via `packages/ui/globals.css` with `rel="preload"` and `font-display: swap`,
**When** any app renders,
**Then** there is no Cumulative Layout Shift caused by font loading (system-ui fallback stack has similar metrics)

**Given** shadcn/ui components (Button, Input, Textarea, Select, Badge, Table, Dialog, AlertDialog, Sheet, Progress, Skeleton, Toast, Tooltip, Avatar) are installed in packages/ui,
**When** any component is imported in any app,
**Then** it renders without TypeScript or runtime errors and applies Star Energy token values

**Given** Button is rendered with `variant="primary"` in the audit app context,
**When** inspected,
**Then** it has `min-h-[44px]` touch target and `bg-[#1B6BDB]` background applied via Tailwind

---

### Story 0.8: Accessibility & Testing Infrastructure

As a developer,
I want axe-core integrated in Vitest, jsx-a11y in ESLint, skip links in all app layouts, and Playwright viewport tests configured,
So that accessibility violations are caught at author time and build time before any feature code ships.

**Acceptance Criteria:**

**Given** `@axe-core/vitest` is installed and configured in all three apps,
**When** a component test runs `expect(await axe(container)).toHaveNoViolations()`,
**Then** the assertion works and a real accessibility violation causes the test to fail with a descriptive message

**Given** `eslint-plugin-jsx-a11y` is configured in all three apps with zero-warnings policy,
**When** a component has an icon-only button missing `aria-label`,
**Then** ESLint reports a violation that fails the CI lint step

**Given** each app's root layout renders,
**When** a keyboard user presses Tab as the first interaction,
**Then** focus moves to a visually visible "Skip to main content" link; pressing Enter navigates focus to `#main-content`

**Given** Playwright is configured with visual regression baselines,
**When** visual regression tests run against audit-app,
**Then** screenshots are captured at 375px, 390px, 768px, 1024px, and 1280px and compared to baselines — a visual diff fails the test

**Given** the full CI pipeline runs,
**When** any axe violation, jsx-a11y warning, or Playwright regression is present,
**Then** the CI pipeline fails and reports which test failed

---

