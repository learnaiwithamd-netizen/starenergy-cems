---
stepsCompleted: [1, 2, 3]
inputDocuments:
  - "_bmad-output/planning-artifacts/prd.md"
  - "_bmad-output/planning-artifacts/architecture.md"
  - "_bmad-output/planning-artifacts/ux-design-specification.md"
---

# Star Energy CEMS - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for Star Energy CEMS, decomposing the requirements from the PRD, UX Design Specification, and Architecture into implementable stories.

## Requirements Inventory

### Functional Requirements

FR1: Auditor can select an assigned store from a pre-loaded list of locations authorized for their login
FR2: Auditor can view auto-populated store details (name, address, banner, region, operating hours, service providers, managers) based on store selection
FR3: Auditor can navigate the energy audit as a guided, sequential workflow of screens organized by system section
FR4: Auditor can complete all five system sections: General, Refrigeration (Machine Room, Racks, Compressors, Condensers, Walk-Ins, Display Cases, Controllers, Systems), HVAC, Lighting, and Building Envelope
FR5: Auditor can view context-sensitive help instructions and a sample reference image at every data entry screen
FR6: Auditor cannot progress past a screen until all required fields for that screen are completed
FR7: Auditor can duplicate a previously entered rack or equipment entry to pre-fill a similar entry
FR8: Auditor can save an in-progress audit as a draft at any point and resume from any device without data loss
FR9: Auditor can submit a completed audit once all required fields across all sections are filled
FR10: System stamps each submitted audit with the active form version and compressor database version at time of submission
FR11: Auditor can capture photos directly within the audit workflow using the device camera
FR12: Auditor can view the required framing instructions and a sample reference photo before capturing each required photo
FR13: System automatically associates each photo to its equipment, section, and screen context at point of capture
FR14: Auditor can add additional photos beyond the required minimum at any screen
FR15: Auditor can add a text comment alongside any photo
FR16: System can automatically run ECM refrigeration savings calculations (floating suction pressure control and floating head pressure control) from submitted audit data
FR17: System can automatically run weather-normalized energy baseline analysis (CDD/HDD regression) from submitted audit data
FR18: System can apply temperature-to-pressure conversions for all refrigerant types supported in the compressor database
FR19: System (via LLM integration) can analyze calculation inputs and outputs and flag anomalies for admin review before approval
FR20: Admin can view each flagged anomaly with the LLM's reasoning and choose to override it with a mandatory justification note
FR21: Admin can view all calculation inputs, intermediate values, and outputs for any calculation run
FR22: Admin can re-run calculations after resolving or overriding flagged anomalies
FR23: System enforces the audit state machine: DRAFT → IN_REVIEW → FLAGGED or CALC_COMPLETE → APPROVED → DELIVERED → CLOSED
FR24: Admin can view all audits in a queue, filterable by state, site, client, and date
FR25: Admin can approve an audit in CALC_COMPLETE state, advancing it to APPROVED
FR26: Admin can resolve a FLAGGED audit by applying overrides and justifications without returning the audit to the auditor
FR27: System pauses the report SLA clock when an audit enters FLAGGED state and restores it when the flag is resolved
FR28: Admin can archive a DELIVERED audit to CLOSED state
FR29: Photo assets are locked from modification when an audit transitions to IN_REVIEW, and become immutable upon APPROVED
FR30: Admin can generate a formatted PDF report from an approved audit, including equipment inventory, tagged photos, energy baseline analysis, and projected savings
FR31: Admin can publish an approved report to the client portal in a single action
FR32: Published (APPROVED) reports are immutable — no edits are permitted after approval
FR33: Admin can regenerate a report if calculation changes are made prior to the APPROVED state
FR34: Client can view a dashboard of all their audit projects across all assigned sites, showing current status for each
FR35: Client can view per-site audit history and access all approved reports for that site
FR36: Client can download an approved audit report as a PDF
FR37: Client can only view and access data and reports for sites assigned to their account
FR38: Users can authenticate with their credentials and receive access only to the interface and data their role permits
FR39: Admin can create, edit, and deactivate Auditor accounts
FR40: Admin can create, edit, and deactivate Client accounts and assign them to specific site locations
FR41: System enforces role-based interface access: Auditors → Site Audit App only; Clients → Client Portal only; Admins → all interfaces
FR42: System enforces row-level data isolation so each client account can only retrieve records for their own assigned locations
FR43: Admin can pre-load and manage store reference data (store number, name, banner, address, region, operating hours, service providers, managers) accessible to auditors during audit collection
FR44: Admin can manage the compressor regression database — add, update, and retire compressor models — without requiring code changes
FR45: Auditor can enter a new compressor model on-site when the model is not found in the database, triggering an admin notification to sync the new entry to the central database
FR46: System can retrieve current outdoor temperature and historical degree-day data for a site's location from external weather data sources
FR47: Admin can manually enter degree-day data when the external weather data API is unavailable
FR48: System can auto-populate store address details via an address lookup service using the store number
FR49: System notifies the admin by email when an auditor submits a completed audit
FR50: System sends an email confirmation to the auditor when their audit submission is received
FR51: System notifies the admin with an in-app alert and pauses the SLA clock when the LLM flags an anomaly during calculation review
FR52: System notifies the client by email when an approved report is published to their portal
FR53: System alerts the admin when an auditor submits a compressor model not found in the regression database
FR54: Multiple auditors can be assigned to the same site audit and work on different sections simultaneously
FR55: System prevents two auditors from editing the same audit section at the same time — section displays "In Progress by [auditor name]" when locked by another auditor
FR56: Section locks expire automatically after a configurable inactivity timeout (heartbeat-based) so an abandoned session does not permanently block other auditors
FR57: Audit submission is permitted only when all required sections are complete, regardless of which auditor completed each section

### NonFunctional Requirements

NFR-P1: Site Audit App screen transitions complete in ≤2 seconds on a standard 4G mobile connection
NFR-P2: Auto-save executes in the background without blocking or delaying auditor UI interaction
NFR-P3: Calculation engine (ECM refrigeration savings + energy baseline) completes within 60 seconds of audit submission
NFR-P4: PDF report generation completes within 5 minutes of admin triggering report creation
NFR-P5: Admin Console audit queue loads in ≤3 seconds for up to 100 active audit records
NFR-P6: External API calls (weather, Google Maps) time out after 5 seconds and surface a defined fallback or error state — auditor workflow is never blocked by external API latency
NFR-S1: All data in transit between client and server is encrypted via TLS 1.2 or higher
NFR-S2: All data at rest — audit data, photos, calculation results, report PDFs — is encrypted in Azure storage
NFR-S3: Row-level data isolation is enforced at the database layer (Azure SQL RLS) — client data separation cannot be bypassed at the application layer
NFR-S4: All admin override actions (LLM flag overrides, calculation corrections, justification notes) are recorded in an immutable audit log with timestamp and user identity
NFR-S5: API keys and service credentials are never embedded in client-side code; all secrets are managed via environment-level secret management
NFR-S6: User sessions expire after a configurable period of inactivity (Auditor: 8h, Admin/Client: 4h)
NFR-S7: LLM (Claude API) calls transmit only the audit data fields necessary for anomaly analysis — no raw personally identifiable information is included in prompts
NFR-SC1: System supports 20 concurrent active audit projects at launch without performance degradation
NFR-SC2: System architecture supports scaling to 100 concurrent active audit projects at 12 months through infrastructure-only changes
NFR-SC3: All data models are tenant-ID scoped from Day 1, enabling multi-tenant onboarding in post-MVP without schema migration
NFR-R1: System availability target: 99.5% uptime during business hours (Monday–Friday, 6am–8pm local time)
NFR-R2: Zero audit data loss — if a network drop occurs mid-audit, all previously saved field data is fully recoverable from the server on reconnect
NFR-R3: Calculation results are stored with a full snapshot of their inputs — any historical audit can be recalculated from stored data and produce the same result (reproducibility)
NFR-R4: Photo uploads that fail due to connectivity are retried automatically; auditor is notified of final upload status (success or permanent failure)
NFR-R5: If the Claude API is unavailable, the audit enters a manual-review holding state and admin is notified — the audit pipeline does not silently stall
NFR-A1: All interactive elements in the Site Audit App meet a minimum touch target size of 44×44 points; 48×48pt on compressor and photo capture screens
NFR-A2: Audit app UI does not rely solely on color to communicate status — all status indicators include text labels or icons
NFR-I1: Each external API integration (weather, Google Maps, degreedays.net) has a defined fallback behavior — external API failures do not block the auditor or admin workflow
NFR-I2: The Claude API integration must return a response or timeout within 30 seconds
NFR-I3: Transactional email notifications achieve ≥98% delivery rate (provider SLA target)
NFR-I4: All external API integrations use versioned endpoints; the system handles upstream API version changes without silent data corruption or calculation errors

### Additional Requirements

- Arc-1: Initialize Turborepo monorepo with `npx create-turbo@latest cems --package-manager pnpm`; configure pnpm workspaces; create the full directory structure defined in architecture (5 apps + 4 packages)
- Arc-2: Set up Azure SQL Database (S2 tier, Canada Central); initialize Prisma schema with all entities; configure `@prisma/adapter-mssql`; apply RLS policies for tenant_id and user role
- Arc-3: Configure Azure Cache for Redis (C0 dev, C1 prod) for BullMQ job queues; define all cache keys and TTLs as documented (compressor_db: 24h, section_lock: 90s, store_ref: 1h, weather: 6h)
- Arc-4: Configure Azure Blob Storage (LRS) with state-gated SAS token issuing — photos locked at IN_REVIEW, immutable at APPROVED; PDFs stored and served via signed URLs
- Arc-5: Configure Azure Key Vault (Standard) for all secrets (DB connection strings, JWT secret, API keys, Claude API key, Resend key); inject as environment variables at runtime — no secrets in code
- Arc-6: Set up three environments (dev/staging/prod) all in Azure Canada Central; staging mirrors production SKUs with separate data
- Arc-7: Implement GitHub Actions CI/CD pipeline: lint → type-check → test → build → deploy; PR preview deployments via Azure Static Web Apps; API zero-downtime deploys via slot swap
- Arc-8: Configure Turborepo Remote Cache and filtered builds (`turbo run --filter=[HEAD^1]`)
- Arc-9: Configure Application Insights with Pino structured JSON logging; define alert rules for API p95 latency >800ms, job failure rate >5%, Redis connection failures
- Arc-10: Create `packages/types` with shared TypeScript types + Zod schemas for all entities (AuditStatus enum, Audit, AuditSection, UserRole, CalcResult, LlmFlag, OverrideRecord, form schemas); export all timing constants (SECTION_LOCK_TTL_MS=90000, HEARTBEAT_MS=30000, POLL_MS=15000, PHOTO_MAX_SIZE_BYTES=10MB)
- Arc-11: Create `packages/db` with Prisma schema + generated client + RLS middleware (`rls.ts` sets SESSION_CONTEXT before every query); immutable `audit-log.repo.ts` (insert-only, no update/delete methods)
- Arc-12: Create `packages/config` with shared ESLint, TypeScript configs (base/app/server), Tailwind preset; all three apps inherit from shared preset
- Arc-13: Implement BullMQ async job pipeline with four job types: `cems:calculation:normal`, `cems:pdf-generation:normal`, `cems:email-notification:low`, `cems:llm-review:normal`; 3 attempts with exponential backoff; job lifecycle events logged to Application Insights
- Arc-14: Implement Puppeteer PDF generation with internal renderer at `apps/api/src/renderer/`; separate Vite build entry for `ReportTemplate`; internal route at `/internal/report/:auditId` (service-token auth, Puppeteer only)
- Arc-15: Implement Python 3.12 + FastAPI calculation microservice at `apps/calc-service/`; three endpoints: POST /calculate/ecm, POST /calculate/baseline, POST /calculate/refrigerant; internal-only via Azure Container Apps VNet ingress; 30s timeout with circuit breaker
- Arc-16: Implement JWT authentication with role-specific TTLs (Auditor: 8h access / 7d refresh; Admin/Client: 4h access / 1d refresh); refresh token rotation with revocation via sessions table; email/password only at MVP
- Arc-17: Implement audit state machine as server-side service (`audit-state-machine.ts`); all state transitions server-enforced; invalid transitions rejected at API; every transition logged to audit_log
- Arc-18: Implement section-level locking (`section-lock.ts`) with Redis TTL-based locks (90s), heartbeat renewal (30s), poll-based client refresh (15s); lock expiry on heartbeat stop; "In Progress by [name]" indicator
- Arc-19: All REST API endpoints under `/api/v1/` prefix from Day 1; OpenAPI 3.0 spec auto-generated at `/api/v1/docs` via `@fastify/swagger`; RFC 7807 error format enforced globally
- Arc-20: Form version and compressor DB version stamped on every audit submission row (`form_version`, `compressor_db_version` columns)
- Arc-21: URL-driven audit wizard navigation — every screen has a stable URL; deep link resume via `current_section_id` stored server-side; browser back/forward works throughout audit

### UX Design Requirements

UX-DR1: Implement Star Energy design token system in `packages/config/tailwind/preset.ts` — full color token set (primary/success/warning/danger/highlight/surface/text), 4px-based spacing scale, Inter typography scale (7 levels), and surface personality overrides per app
UX-DR2: Build `packages/ui` shared component library from shadcn/ui: Button (with primary/secondary/destructive/ghost/disabled variants), Input, Textarea, Select/Combobox, Badge, Table, Dialog, AlertDialog, Tooltip, Sheet, Progress, Skeleton, Toast, Avatar — all themed to Star Energy tokens
UX-DR3: Implement `SectionProgressBar` custom component (`audit-app/features/audit/components/SectionProgress.tsx`) — progress track + "X of 5 sections" label; states: in-progress (blue), complete (green)
UX-DR4: Implement `SectionCard` custom component (`audit-app/features/audit/components/SectionCard.tsx`) — states: not-started, in-progress (blue border), complete (green + ✓), locked-by-other (amber + "In Progress by [name]"); role="button" + aria-label="[Section name]: [status]" + aria-disabled when locked
UX-DR5: Implement `AuditBreadcrumb` custom component (`audit-app/features/audit/components/AuditBreadcrumb.tsx`) — `<nav aria-label="Audit navigation">` + `<ol>` structure; clickable parent segments; current item non-clickable; truncation with ellipsis at max-w-[60vw]
UX-DR6: Implement `AutoSaveIndicator` custom component (`audit-app/features/audit/components/AutoSaveIndicator.tsx`) — states: saved (✓ fades 2s), saving (subtle spinner), reconnecting (amber persistent top banner), offline (red persistent banner "Offline — last saved Xm ago"); aria-live="polite"; never a modal
UX-DR7: Implement `PhotoCaptureField` custom component (`audit-app/features/photos/components/CameraCapture.tsx`) — states: empty, uploading, uploaded (thumbnail + auto-tag), failed (retry); camera permission denied → graceful fallback to file input; aria-label="Capture [photo type] photo"
UX-DR8: Implement `LlmFlagCard` custom component (`admin-app/features/calc-review/components/LlmFlagCard.tsx`) — flag header (icon + title + confidence %) + reasoning text + actual vs. expected + Override/Accept buttons + justification textarea; Override button disabled until justification non-empty; role="region" + aria-label
UX-DR9: Implement `AuditStatusBadge` custom component (`admin-app/features/audit-queue/components/AuditStatusBadge.tsx`) — one variant per audit state; always text + icon alongside color (never color alone); maps all 7 states to correct design tokens
UX-DR10: Implement `SlaTimer` custom component (`admin-app/features/audit-queue/components/SlaTimer.tsx`) — states: ok (green >3h), warning (amber 1-3h), urgent (red <1h), paused (gray "SLA clock paused"); aria-label updated per render
UX-DR11: Implement `SiteCard` custom component (`client-portal/features/dashboard/components/SiteCard.tsx`) — site name + status badge + savings metrics (cost + kWh) + report date + "View Report →"; states: report-ready, in-progress ("Calculating…"), not-started
UX-DR12: Implement `generatePhotoAltText` utility in `packages/ui/utils/generateAltText.ts` — signature: (equipmentType, equipmentId, photoType, sectionContext) → structured alt text string; fallback for unassigned equipment ID; called by PhotoCaptureField at capture time
UX-DR13: Configure `@axe-core/vitest` in all three apps' Vitest test suites; add route-level axe scan tests for all primary routes; accessibility AC ("zero axe violations") on every story Definition of Done
UX-DR14: Configure `eslint-plugin-jsx-a11y` in all three apps' ESLint config; zero-warnings policy enforced in CI
UX-DR15: Implement skip-to-main-content skip link in every app's root layout — `sr-only focus:not-sr-only` positioned; visible on keyboard focus; links to `#main-content` landmark
UX-DR16: Configure Playwright visual regression tests at 5 viewport widths: 375px, 390px, 768px, 1024px, 1280px; run on every PR for all three surfaces
UX-DR17: Configure Inter font loading at `packages/ui/globals.css` — `<link rel="preload">` + `font-display: swap`; system-ui fallback stack; no CLS on font load
UX-DR18: Implement client portal responsive site card grid — `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`; collapses to 2-col at sm (480px), 1-col at default; report view stays single-column at all widths
UX-DR19: Admin console audit queue table responsive behavior at lg breakpoint (1024px) — priority columns only (Status, Site Name, Auditor, SLA Timer); secondary columns hidden via `hidden lg:table-cell`
UX-DR20: Implement bottom-anchored primary button in audit app — `fixed bottom-0 left-0 right-0` + `pb-safe` (iOS safe area inset via env(safe-area-inset-bottom)); never obscured by on-screen keyboard
UX-DR21: Implement attempt-first form validation pattern throughout audit app — errors surface when user taps Next (red border + shake animation on unfilled fields), not while typing; error messages describe the fix, not the problem

### FR Coverage Map

| FR | Epic | Domain |
|---|---|---|
| FR1 | Epic 2 | Store selection |
| FR2 | Epic 2 | Store auto-fill |
| FR3 | Epic 3 | Sequential wizard navigation |
| FR4 | Epic 3 + Epic 5 | Refrigeration (E3); Other sections (E5) |
| FR5 | Epic 3 + Epic 5 | Help tooltips across all sections |
| FR6 | Epic 3 + Epic 5 | Required field validation |
| FR7 | Epic 3 | Entry duplication |
| FR8 | Epic 2 | Draft auto-save + resume |
| FR9 | Epic 5 | Audit submission |
| FR10 | Epic 3 | Form + DB version stamping |
| FR11 | Epic 4 | Camera capture |
| FR12 | Epic 4 | Photo framing instructions |
| FR13 | Epic 4 | Auto-tagging |
| FR14 | Epic 4 | Additional photos |
| FR15 | Epic 4 | Photo comments |
| FR16 | Epic 8 | ECM refrigeration calculation |
| FR17 | Epic 8 | Energy baseline (CDD/HDD) |
| FR18 | Epic 8 | Refrigerant temp-to-pressure |
| FR19 | Epic 8 | LLM anomaly flagging |
| FR20 | Epic 8 | Flag override + justification |
| FR21 | Epic 8 | Calculation inputs/outputs view |
| FR22 | Epic 8 | Re-run calculations |
| FR23 | Epic 2 + Epic 7 | DRAFT creation (E2); full state machine (E7) |
| FR24 | Epic 7 | Admin queue with filters |
| FR25 | Epic 7 | Admin approval action |
| FR26 | Epic 8 | FLAGGED resolution |
| FR27 | Epic 8 | SLA clock pause/restore on FLAGGED |
| FR28 | Epic 7 | Archive to CLOSED |
| FR29 | Epic 4 + Epic 7 | Photo locking at state transition |
| FR30 | Epic 9 | PDF generation |
| FR31 | Epic 9 | Publish to client portal |
| FR32 | Epic 9 | Report immutability |
| FR33 | Epic 9 | Report regeneration (pre-APPROVED) |
| FR34 | Epic 10 | Multi-site dashboard |
| FR35 | Epic 10 | Per-site audit history |
| FR36 | Epic 10 | PDF download |
| FR37 | Epic 10 | Data isolation (client sees own sites only) |
| FR38 | Epic 1 | Authentication |
| FR39 | Epic 1 | Auditor account management |
| FR40 | Epic 1 | Client account management |
| FR41 | Epic 1 | Role-based interface access |
| FR42 | Epic 1 | Row-level data isolation |
| FR43 | Epic 2 + Epic 6 | Store data read for auditors (E2); admin-managed (E6) |
| FR44 | Epic 6 | Compressor DB management |
| FR45 | Epic 3 | New compressor on-site entry |
| FR46 | Epic 6 | Weather data retrieval |
| FR47 | Epic 6 | Manual degree-day entry |
| FR48 | Epic 2 | Address auto-populate via Google Maps |
| FR49 | Epic 5 | Admin email on audit submit |
| FR50 | Epic 5 | Auditor email confirmation |
| FR51 | Epic 8 | Admin in-app alert on LLM flag |
| FR52 | Epic 9 | Client email on report publish |
| FR53 | Epic 3 | Admin alert on compressor not found |
| FR54 | Epic 3 | Multi-auditor assignment |
| FR55 | Epic 3 | Section lock indicator |
| FR56 | Epic 3 | Lock expiry on inactivity |
| FR57 | Epic 3 + Epic 5 | All sections complete before submit |

## Epic List

### Epic 0: Platform Foundation & Developer Infrastructure
The development team can build, test, and deploy all three applications. Shared infrastructure (Azure SQL, Redis, Blob, Key Vault), design tokens, and base component library are in place before any feature work begins.
**Covers:** Arc-1 to Arc-21, UX-DR1, UX-DR2, UX-DR13–UX-DR17

### Epic 1: Authentication & User Management
All three user types (Auditor, Admin, Client) can log in and access only their permitted surface and data. Admin can create and manage user accounts.
**FRs covered:** FR38, FR39, FR40, FR41, FR42

### Epic 2: Audit App — Store Selection & Session Foundation
Auditor can select an assigned store, auto-fill store details, start a new audit as a draft, and resume an in-progress audit from any device without data loss.
**FRs covered:** FR1, FR2, FR8, FR23 (DRAFT), FR43 (store data read), FR48, FR49, FR50

### Epic 3: Refrigeration Data Collection (Core Audit Engine)
Auditor can complete the full refrigeration section — Machine Room → Racks → Compressors → Condensers → Walk-ins → Display Cases → Controller → Systems — with guided navigation, field validation, help tooltips, entry duplication, on-site new compressor entry, and multi-auditor section locking.
**FRs covered:** FR3, FR4 (refrigeration), FR5, FR6, FR7, FR10, FR45, FR53, FR54, FR55, FR56, FR57

### Epic 4: Photo Capture & Management
Auditor can capture equipment photos within the audit workflow using the device camera, auto-tagged to current equipment/section, with upload status tracking and file input fallback.
**FRs covered:** FR11, FR12, FR13, FR14, FR15, FR29

### Epic 5: Remaining Audit Sections & Submission
Auditor can complete the General, HVAC, Lighting, and Building Envelope sections and submit a complete audit with an all-green review screen — unambiguous completion certainty.
**FRs covered:** FR4 (General/HVAC/Lighting/BldgEnv), FR5, FR6, FR9, FR49, FR50, FR57

### Epic 6: Reference Data & System Configuration
Admin can manage the store reference database, maintain the compressor regression database without code changes, and manually enter weather data when APIs are unavailable.
**FRs covered:** FR43 (admin-side), FR44, FR46, FR47

### Epic 7: Admin Audit Queue & State Machine
Admin can view all audits in a filterable queue, track SLA timers, and drive audits through state transitions.
**FRs covered:** FR23 (full state machine), FR24, FR25, FR26, FR27, FR28, FR29

### Epic 8: Calculation Engine & LLM Review
Admin can trigger the ECM refrigeration and energy baseline calculation pipeline, review Claude's anomaly flags, override with justification, and re-run calculations with full reproducibility.
**FRs covered:** FR16, FR17, FR18, FR19, FR20, FR21, FR22, FR26, FR27, FR51, FR53

### Epic 9: Report Generation & Publishing
Admin can generate a formatted PDF report, preview it, and publish it to the Client Portal in one action — with client email notification on publish.
**FRs covered:** FR30, FR31, FR32, FR33, FR52

### Epic 10: Client Portal
Client can view a multi-site dashboard, access approved reports per site, and download PDFs.
**FRs covered:** FR34, FR35, FR36, FR37

---

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

## Epic 1: Authentication & User Management

All three user types (Auditor, Admin, Client) can log in and access only their permitted surface and data. Admin can create and manage user accounts.

**FRs covered:** FR38, FR39, FR40, FR41, FR42

---

### Story 1.1: Email/Password Login & JWT Issuance

As a user (Auditor, Admin, or Client),
I want to log in with my email and password,
So that I receive a JWT that grants me access to exactly the surfaces and data my role permits.

**Acceptance Criteria:**

**Given** a valid email and password are submitted to POST `/api/v1/auth/login`,
**When** credentials match a user in the database,
**Then** an access token (role-embedded JWT) and a refresh token are returned; access token TTL is 8h for Auditor, 4h for Admin/Client

**Given** an invalid email or wrong password is submitted,
**When** the login route processes the request,
**Then** RFC 7807 401 is returned — no hint whether email or password was wrong (no enumeration)

**Given** a valid access token is included in an API request,
**When** the auth middleware validates it,
**Then** the request proceeds with role and tenant_id extracted from the token — no database lookup on every request

**Given** an expired access token is used,
**When** the auth middleware checks expiry,
**Then** RFC 7807 401 is returned with `type: "token-expired"`

**Given** POST `/api/v1/auth/refresh` is called with a valid refresh token,
**When** the refresh token is found in user_sessions and not expired,
**Then** a new access token and rotated refresh token are returned; the old refresh token is invalidated

**Given** POST `/api/v1/auth/logout` is called,
**When** the refresh token is revoked,
**Then** the user_sessions row is deleted and subsequent refresh attempts with that token return 401

---

### Story 1.2: Role-Based Surface Access & Route Guards

As a user,
I want my browser to route me to the correct application surface on login,
So that Auditors only see the Site Audit App, Admins see the Admin Console, and Clients see the Client Portal.

**Acceptance Criteria:**

**Given** an Auditor logs in,
**When** authentication succeeds,
**Then** the browser navigates to the audit-app — the admin-app and client-portal URLs redirect to the audit-app login

**Given** an Admin logs in,
**When** authentication succeeds,
**Then** the browser navigates to the admin-app — the audit-app and client-portal URLs redirect to the admin-app login

**Given** a Client logs in,
**When** authentication succeeds,
**Then** the browser navigates to the client-portal — the audit-app and admin-app URLs redirect to the client-portal login

**Given** an unauthenticated user attempts to navigate to any protected route,
**When** the React Router auth guard runs,
**Then** the user is redirected to the login page for that surface

**Given** a Client-role JWT is used to call an Admin-only API endpoint,
**When** the auth middleware checks role permissions,
**Then** RFC 7807 403 is returned

---

### Story 1.3: Admin User Management — Auditor Accounts

As an Admin,
I want to create, edit, and deactivate Auditor accounts,
So that field technicians can be onboarded and offboarded without engineering involvement.

**Acceptance Criteria:**

**Given** an Admin submits POST `/api/v1/users` with `role: "AUDITOR"` and valid email,
**When** the request is processed,
**Then** a new user record is created, a welcome email is sent with a password-set link, and the account is ACTIVE

**Given** an Admin submits PATCH `/api/v1/users/:id` with updated name or email,
**When** the request is processed,
**Then** the user record is updated and changes take effect immediately

**Given** an Admin submits PATCH `/api/v1/users/:id` with `status: "INACTIVE"`,
**When** the request is processed,
**Then** the user is deactivated; any active sessions for that user are revoked; the user cannot log in

**Given** an Admin views GET `/api/v1/users?role=AUDITOR`,
**When** the response is returned,
**Then** only Auditor accounts scoped to the Admin's tenant are listed (RLS enforced)

---

### Story 1.4: Admin User Management — Client Accounts & Site Assignment

As an Admin,
I want to create Client accounts and assign them to specific store locations,
So that clients can log in and see only the data for their sites — no other client's data is ever visible.

**Acceptance Criteria:**

**Given** an Admin submits POST `/api/v1/users` with `role: "CLIENT"` and a list of `assignedStoreIds`,
**When** the request is processed,
**Then** a Client user is created with store assignments stored; a welcome email is sent

**Given** a Client user logs in and calls GET `/api/v1/audits`,
**When** Azure SQL RLS applies the client's assigned store IDs,
**Then** only audit records for their assigned stores are returned — confirmed by attempting to fetch an audit for an unassigned store and receiving 404

**Given** an Admin updates a Client's store assignments via PATCH `/api/v1/users/:id`,
**When** new assignments take effect,
**Then** the Client immediately gains access to newly assigned stores and loses access to removed ones on their next API call

**Given** an Admin deactivates a Client account,
**When** the Client attempts to log in,
**Then** login fails with 401; active sessions are revoked

---

## Epic 2: Audit App — Store Selection & Session Foundation

Auditor can select an assigned store, auto-fill store details, start a new audit as a draft, and resume an in-progress audit from any device without data loss.

**FRs covered:** FR1, FR2, FR8, FR23 (DRAFT), FR43 (store data read), FR48, FR49, FR50

---

### Story 2.1: Store Reference Data API & Store Selector Screen

As an Auditor,
I want to see a list of my assigned stores when I open the app,
So that I can tap a store and immediately start an audit without typing any store details.

**Acceptance Criteria:**

**Given** an Auditor is authenticated and opens the audit app,
**When** the Store Selector page loads,
**Then** GET `/api/v1/stores?assignedToUser=true` returns only stores assigned to this Auditor's account, rendered as a searchable list

**Given** the stores list is loading,
**When** the TanStack Query initial fetch is in progress,
**Then** skeleton UI matching the store list layout is shown — no spinner overlay

**Given** an Auditor has no assigned stores,
**When** the list renders,
**Then** an empty state is shown: "No stores assigned — contact your administrator"

**Given** the store list has loaded,
**When** an Auditor types in the search field,
**Then** the list filters to matching store name or store number in real time (client-side filter, no new API call)

**Given** an Auditor taps a store,
**When** the store is selected,
**Then** the app navigates to the audit initiation screen for that store

---

### Story 2.2: Store Auto-Fill & New Audit Draft Creation

As an Auditor,
I want store details to auto-fill when I select a store and a new audit draft to be created immediately,
So that I don't manually type reference data and my audit is already persisted before I enter a single field.

**Acceptance Criteria:**

**Given** an Auditor taps a store on the Store Selector,
**When** the audit initiation screen loads,
**Then** GET `/api/v1/stores/:storeNumber` returns and pre-fills: store name, address, banner, region, operating hours, service provider(s), and store manager — from the store reference DB (Redis-cached 1h)

**Given** the store address lookup via Google Maps API is called,
**When** the Maps API responds within 5 seconds,
**Then** address fields are filled from the Maps response; if the Maps API fails or times out, the locally stored address is used as fallback — workflow is never blocked (NFR-P6)

**Given** the Auditor taps "Start Audit",
**When** POST `/api/v1/audits` is called,
**Then** a new audit record is created in DRAFT state with `storeId`, `auditorId`, `tenantId`, `form_version`, `compressor_db_version`, and `current_section_id: "general"` populated; `auditId` is returned

**Given** the audit draft is created,
**When** the browser navigates to `/audit/:auditId/section/general`,
**Then** the Section Overview screen renders with 5 SectionCards all in "Not Started" state

---

### Story 2.3: Auto-Save & Session Resume

As an Auditor,
I want my audit data saved automatically on every field change and my session to resume exactly where I left off,
So that a browser close, network drop, or mid-audit interruption never results in lost data.

**Acceptance Criteria:**

**Given** an Auditor changes a field value in any section,
**When** 800ms elapses after the last keystroke (debounce),
**Then** PATCH `/api/v1/audits/:id/sections/:sectionId` is called silently — no spinner, no UI blocking (NFR-P2)

**Given** the auto-save PATCH succeeds,
**When** the AutoSaveIndicator receives the success event,
**Then** "✓ Saved" green badge appears and fades after 2 seconds; `aria-live="polite"` announces the save to screen readers

**Given** the auto-save PATCH fails due to network error,
**When** the AutoSaveIndicator receives the error,
**Then** "Save failed — retrying" amber badge appears persistently; automatic retry is attempted

**Given** connectivity is lost mid-audit,
**When** the AutoSaveIndicator detects offline state,
**Then** a persistent amber top banner reads "Reconnecting… — last saved [X]m ago"; no modal; no data loss from previously saved fields (NFR-R2)

**Given** an Auditor closes their browser mid-audit and reopens the app on any device,
**When** the Auditor authenticates,
**Then** GET `/api/v1/audits?status=DRAFT&auditorId=me` finds the in-progress audit; Section Overview shows accurate section completion states

**Given** an Auditor taps "Continue" on an in-progress section,
**When** the app navigates,
**Then** the browser goes to `/audit/:auditId/section/:sectionId` matching `current_section_id` stored server-side — all previously entered data is pre-filled

---

### Story 2.4: Section Overview & Navigation Shell

As an Auditor,
I want a clear overview of all five audit sections showing completion status,
So that I always know exactly where I am in the audit, what's done, and what's left.

**Acceptance Criteria:**

**Given** an Auditor is on the Section Overview screen,
**When** the page renders,
**Then** five SectionCards are displayed: General, Refrigeration, HVAC, Lighting, Building Envelope — each showing its current status

**Given** a section has zero fields filled,
**When** the SectionCard renders,
**Then** it shows "Not Started" state (gray, no checkmark); `aria-label="[Section name]: Not Started"`

**Given** a section has some but not all required fields complete,
**When** the SectionCard renders,
**Then** it shows "In Progress" state (blue border); `aria-label="[Section name]: In Progress"`

**Given** a section has all required fields complete,
**When** the SectionCard renders,
**Then** it shows "Complete" state (green + ✓ checkmark animation on transition); `aria-label="[Section name]: Complete"`

**Given** an Auditor taps a Not Started or In Progress section card,
**When** navigation occurs,
**Then** the browser navigates to the first incomplete screen in that section

**Given** a SectionProgressBar renders at the top of the audit wizard,
**When** sections complete,
**Then** the bar updates to reflect current count (e.g., "2 of 5 sections complete")

---

## Epic 3: Refrigeration Data Collection (Core Audit Engine)

Auditor can complete the full refrigeration section — Machine Room → Racks → Compressors → Condensers → Walk-ins → Display Cases → Controller → Systems — with guided navigation, field validation, help tooltips, entry duplication, on-site new compressor entry, and multi-auditor section locking.

**FRs covered:** FR3, FR4 (refrigeration), FR5, FR6, FR7, FR10, FR45, FR53, FR54, FR55, FR56, FR57

---

### Story 3.1: Audit Breadcrumb & Machine Room Screen

As an Auditor,
I want a breadcrumb showing my exact position in the refrigeration hierarchy and a guided Machine Room data entry screen,
So that I never lose my place in the deep refrigeration structure and can complete the first screen confidently.

**Acceptance Criteria:**

**Given** an Auditor enters the Refrigeration section,
**When** the Machine Room screen renders,
**Then** the AuditBreadcrumb component shows "Refrigeration › Machine Room" using `<nav aria-label="Audit navigation"><ol>` structure; parent segments are tappable and navigate up

**Given** the Machine Room screen renders,
**When** the Auditor views it,
**Then** all Machine Room fields from the spec (screen 2.1) are displayed with required fields marked `*`; a `?` icon on each field opens a help tooltip with instructions

**Given** an Auditor taps "Next" with one or more required fields empty,
**When** attempt-first validation runs,
**Then** unfilled required fields get red border + shake animation; no modal; "Next" button label shows "N required fields remaining"

**Given** all required Machine Room fields are complete,
**When** the Auditor taps "Next",
**Then** the app navigates to the Rack list screen; `current_section_id` is updated server-side

**Given** the "Next" button renders on mobile,
**When** inspected,
**Then** it is `fixed bottom-0 left-0 right-0` with `pb-safe` (iOS safe area inset) — never obscured by the on-screen keyboard

---

### Story 3.2: Rack Entry, Navigation & Equipment Duplication

As an Auditor,
I want to add multiple racks, navigate into each rack's screens, and duplicate a rack entry to pre-fill similar data,
So that stores with multiple identical racks don't require re-entering the same nameplate data repeatedly.

**Acceptance Criteria:**

**Given** an Auditor is on the Rack list screen,
**When** they tap "Add Rack",
**Then** a new rack entry is created and the Auditor navigates to the Rack data entry screen; breadcrumb shows "Refrigeration › Rack 1"

**Given** an Auditor completes Rack 1 and returns to the Rack list,
**When** they tap "Duplicate Rack 1",
**Then** a new rack is created with all non-unique fields pre-populated from Rack 1 (FR7); the Auditor navigates to the new rack to review and adjust

**Given** multiple racks exist,
**When** the Rack list renders,
**Then** each rack shows its name/number and completion status (Not Started / In Progress / Complete)

**Given** an Auditor taps a breadcrumb segment (e.g., "Refrigeration"),
**When** navigation occurs,
**Then** the app navigates to that hierarchy level; all data is already saved via auto-save

**Given** an Auditor navigates through a rack's sub-equipment screens,
**When** each screen loads,
**Then** breadcrumb updates correctly (e.g., "Refrigeration › Rack 2 › Compressor 1") and truncates with ellipsis beyond `max-w-[60vw]`

---

### Story 3.3: Compressor Screens & Regression DB Lookup

As an Auditor,
I want compressor nameplate data to auto-populate from the regression database when I enter a model number, and to enter data manually when the model isn't found,
So that known compressors require minimal manual entry and unknown compressors are captured accurately on-site.

**Acceptance Criteria:**

**Given** an Auditor enters a compressor model number,
**When** the model is found in the regression DB (GET `/api/v1/compressors/:model`),
**Then** capacity, EER, and refrigerant type fields auto-populate; the Auditor can override any pre-filled value

**Given** a compressor model number is entered and the model is not found,
**When** the lookup returns a 404,
**Then** an inline amber alert appears: "Model not found — enter specs manually. Admin will be notified." (FR45); all spec fields remain editable

**Given** a new compressor model is entered manually and the screen is submitted,
**When** the Auditor taps "Next",
**Then** a `cems:email-notification:low` job is enqueued to alert Admin of the new model (FR53); Auditor progression is not blocked

**Given** the Compressor screen renders on mobile,
**When** inspected,
**Then** all interactive elements meet `min-h-[48px] min-w-[48px]` touch targets (NFR-A1 — gloved operation)

**Given** an Auditor taps "Duplicate" on an existing compressor,
**When** duplication runs (FR7),
**Then** a new compressor screen opens with all non-unique fields (model, refrigerant, EER) pre-filled from the source

---

### Story 3.4: Condenser, Walk-In & Display Case Screens

As an Auditor,
I want guided data entry screens for condensers, walk-in coolers, and display cases within each rack,
So that all refrigeration sub-equipment is captured completely in the same guided sequential flow.

**Acceptance Criteria:**

**Given** an Auditor navigates to the Condenser screen,
**When** the screen renders,
**Then** all Condenser fields (screen 2.5) are shown; breadcrumb shows "Refrigeration › Rack N › Condenser"; required fields marked; help tooltips available

**Given** an Auditor navigates to the Walk-In screen,
**When** the screen renders,
**Then** all Walk-In fields (screen 2.6) are shown; Auditor can add multiple walk-in units per rack; entry duplication is available (FR7)

**Given** an Auditor navigates to the Display Case screen,
**When** the screen renders,
**Then** all Display Case fields (screen 2.7) are shown; Auditor can add multiple display cases; entry duplication is available (FR7)

**Given** required fields are incomplete and the Auditor taps "Next",
**When** attempt-first validation runs,
**Then** unfilled required fields are highlighted red + shake; count label updates on "Next" button

**Given** all required fields on a screen are complete and the Auditor taps "Next",
**When** navigation occurs,
**Then** the app moves to the next screen in the rack's sequence; `current_section_id` is updated server-side

---

### Story 3.5: Controller, Systems Screens & Refrigeration Section Completion

As an Auditor,
I want to complete the Controller and Systems screens and see the Refrigeration section marked complete,
So that I have a clear signal that the hardest section is fully done before moving on.

**Acceptance Criteria:**

**Given** an Auditor navigates to the Controller screen (screen 2.8),
**When** the screen renders,
**Then** all Controller fields are shown with breadcrumb "Refrigeration › Rack N › Controller"; required fields marked; help tooltips available

**Given** an Auditor completes all required screens for all racks,
**When** the last rack's last screen is submitted,
**Then** the API marks the Refrigeration section complete; the Section Overview SectionCard for Refrigeration animates to "Complete" (green + ✓)

**Given** the Refrigeration section is marked complete,
**When** `form_version` and `compressor_db_version` are checked on the audit row,
**Then** both match the versions active at audit creation (FR10)

**Given** the Auditor returns to Section Overview after completing Refrigeration,
**When** they view the progress bar,
**Then** SectionProgressBar shows "1 of 5 sections complete" and the Refrigeration SectionCard is green

---

### Story 3.6: Multi-Auditor Section Locking

As an Auditor,
I want to see when another auditor is actively working in a section and have my own sections protected from concurrent edits,
So that two auditors can work on the same audit simultaneously without overwriting each other's data.

**Acceptance Criteria:**

**Given** Auditor A is actively working in the Refrigeration section,
**When** Auditor B opens the Section Overview for the same audit,
**Then** the Refrigeration SectionCard shows "In Progress by [Auditor A name]" in amber (FR55); Auditor B cannot enter that section

**Given** Auditor A is in a section and sending heartbeat PATCHes every 30 seconds,
**When** a heartbeat is received,
**Then** the Redis lock TTL resets to 90 seconds; the section remains locked for Auditor A

**Given** Auditor A's session becomes inactive (no heartbeat for 90 seconds),
**When** the Redis lock TTL expires (FR56),
**Then** Auditor B's next poll (15s) detects the lock is gone; the SectionCard returns to its previous state and Auditor B can enter the section

**Given** two auditors complete different sections,
**When** both sections are complete,
**Then** the audit can only be submitted when ALL sections are complete regardless of which auditor completed each (FR57); Submit remains disabled until all 5 are green

**Given** Auditor B views a locked section,
**When** the SectionLockedBanner renders,
**Then** it reads "This section is being edited by [name]. It will be available when they finish or after inactivity." — calm, not alarming

---

## Epic 4: Photo Capture & Management

Auditor can capture equipment photos within the audit workflow using the device camera, auto-tagged to the current equipment and section, with upload status tracking and a file input fallback when camera permission is denied.

**FRs covered:** FR11, FR12, FR13, FR14, FR15, FR29

---

### Story 4.1: Camera Capture & PhotoCaptureField Component

As an Auditor,
I want to capture a photo from within the audit screen using my device's rear camera,
So that equipment photos are taken without switching to my camera app and losing my place in the audit.

**Acceptance Criteria:**

**Given** an Auditor reaches a screen requiring a photo,
**When** the PhotoCaptureField component renders in "empty" state,
**Then** a dashed-border capture area is shown with a camera icon CTA; `aria-label="Capture [photo type] photo"` is set

**Given** an Auditor taps the capture area,
**When** `navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })` is called,
**Then** the device's rear camera opens for capture

**Given** camera permission is denied or unsupported,
**When** the MediaDevices API call fails,
**Then** the component falls back to `<input type="file" accept="image/*" capture="environment">` — audit screen remains fully functional

**Given** the Auditor captures a photo,
**When** the image is returned from the camera,
**Then** the PhotoCaptureField transitions to "uploading" state showing a progress indicator; the capture button meets `min-h-[48px] min-w-[48px]` (NFR-A1)

**Given** the photo framing instructions screen is shown before capture,
**When** the Auditor views it (FR12),
**Then** the required framing description and a sample reference image are displayed; the Auditor taps "I'm ready" to proceed to the camera

---

### Story 4.2: Auto-Tagging & Azure Blob Upload

As an Auditor,
I want each photo automatically tagged to the equipment I'm currently documenting,
So that photos never need manual re-association and the audit trail is complete at the point of capture.

**Acceptance Criteria:**

**Given** an Auditor captures a photo on a Compressor screen,
**When** the upload begins,
**Then** POST `/api/v1/photos` is called with `auditId`, `sectionId`, `equipmentId`, `equipmentType`, and `photoType` extracted from the current route context — no manual input required (FR13)

**Given** the photo is uploaded to Azure Blob Storage,
**When** the API stores the photo metadata,
**Then** the photo record includes structured alt text from `generatePhotoAltText(equipmentType, equipmentId, photoType, sectionContext)` — e.g., "Compressor nameplate photo — Refrigeration › Rack 2 › Compressor 1, ID COMP-1042-R2C1"

**Given** the photo upload completes successfully,
**When** the PhotoCaptureField receives the success response,
**Then** the component transitions to "uploaded" state showing the photo thumbnail with the auto-tag label beneath it

**Given** the photo upload fails (network error),
**When** the PhotoCaptureField receives the error,
**Then** the component shows "Upload failed — tap to retry" in red; automatic retry is attempted up to 3 times before surfacing permanent failure (NFR-R4)

**Given** an audit transitions to IN_REVIEW state,
**When** the photo-lifecycle service runs (FR29),
**Then** all photos for that audit are locked in Azure Blob — further uploads to that audit are rejected with 409 Conflict

---

### Story 4.3: Additional Photos & Photo Comments

As an Auditor,
I want to add extra photos beyond the required minimum and attach text comments to any photo,
So that unusual equipment conditions or clarifying context can be documented without blocking the audit flow.

**Acceptance Criteria:**

**Given** the required photo for a screen has been captured,
**When** the PhotoCaptureField renders in "uploaded" state,
**Then** an "Add another photo" secondary button is visible; tapping it opens the camera for an additional capture (FR14)

**Given** an Auditor taps the comment icon on a photo thumbnail,
**When** a text input appears,
**Then** typing and tapping "Save" calls PATCH `/api/v1/photos/:photoId` with the comment text (FR15); the comment persists on re-render

**Given** an Auditor adds 3 or more photos to a single screen,
**When** the photo grid renders,
**Then** thumbnails display in a scrollable grid without overflowing the viewport; each additional (non-required) photo has a delete option

---

### Story 4.4: Upload Queue, Retry & Status Visibility

As an Auditor,
I want to see the upload status of every photo and have failed uploads retry automatically,
So that I'm never surprised by a missing photo at submission and don't have to manage re-uploads manually.

**Acceptance Criteria:**

**Given** multiple photos are uploading simultaneously,
**When** the `usePhotoUploadStore` Zustand store tracks the queue,
**Then** each photo shows its status independently: queued / uploading (progress) / uploaded (✓) / failed (retry)

**Given** a photo upload fails due to a connectivity drop,
**When** connectivity is restored,
**Then** the failed photo is automatically re-queued and retried; the Auditor sees the status update without manual action (NFR-R4)

**Given** a photo upload permanently fails after 3 automatic retries,
**When** the final retry fails,
**Then** the photo status shows "Upload failed — tap to retry manually" in persistent red

**Given** an Auditor reaches the Review & Submit screen,
**When** any required photo has not uploaded successfully,
**Then** the Submit button remains disabled and a message identifies which screens have pending photo uploads; submission is only enabled when all required photos are confirmed uploaded

---

## Epic 5: Remaining Audit Sections & Submission

Auditor can complete the General, HVAC, Lighting, and Building Envelope sections and submit a complete audit with an all-green review confirmation screen.

**FRs covered:** FR4 (General/HVAC/Lighting/BldgEnv), FR5, FR6, FR9, FR49, FR50, FR57

---

### Story 5.1: General Section Screens

As an Auditor,
I want to complete the General section screens with store data pre-filled from the reference database,
So that the first section requires minimal manual entry and I can move quickly to the equipment sections.

**Acceptance Criteria:**

**Given** an Auditor enters the General section,
**When** the first General screen loads (screen 1.01),
**Then** store name, address, banner, region, operating hours, service providers, and manager data are pre-filled from the store reference DB; Auditor can edit any pre-filled field

**Given** the General section has 11 screens (1.01–1.11),
**When** the Auditor navigates through them sequentially,
**Then** each screen shows only its own fields; required fields are marked `*`; help tooltips are available; "Next" uses attempt-first validation

**Given** the Auditor completes all required General fields across all 11 screens,
**When** the last General screen is submitted,
**Then** the General SectionCard on Section Overview updates to "Complete" (green + ✓)

**Given** the General section renders on mobile,
**When** inspected,
**Then** all inputs meet `min-h-[44px]` touch targets; primary button is bottom-anchored with `pb-safe`

---

### Story 5.2: HVAC Section Screens

As an Auditor,
I want to complete the HVAC section screens with all AHU and system-level fields,
So that HVAC equipment data is captured completely in the same guided flow as refrigeration.

**Acceptance Criteria:**

**Given** an Auditor enters the HVAC section,
**When** the first HVAC screen loads,
**Then** all HVAC fields from the spec (screen 3) are displayed; required fields marked; help tooltips available

**Given** the HVAC section uses a flat JSON data model (`audits.hvac_data`),
**When** the Auditor fills in and auto-saves HVAC fields,
**Then** PATCH `/api/v1/audits/:id/sections/hvac` stores the fields as a JSON column

**Given** the Auditor completes all required HVAC fields,
**When** the last HVAC screen is submitted,
**Then** the HVAC SectionCard updates to "Complete" (green + ✓) and SectionProgressBar reflects the updated count

---

### Story 5.3: Lighting & Building Envelope Sections

As an Auditor,
I want to complete the Lighting and Building Envelope sections,
So that all five audit sections are captured in the same consistent guided flow.

**Acceptance Criteria:**

**Given** an Auditor enters the Lighting section (screen 4),
**When** each Lighting screen renders,
**Then** all Lighting fields from the spec are shown; required fields marked; help tooltips available; stored as `audits.lighting_data` JSON column

**Given** an Auditor enters the Building Envelope section (screen 5),
**When** each Building Envelope screen renders,
**Then** all Building Envelope fields from the spec are shown; required fields marked; help tooltips available; stored as `audits.building_envelope_data` JSON column

**Given** the Auditor completes all required fields in both sections,
**When** each section's last screen is submitted,
**Then** both SectionCards update to "Complete" (green + ✓) independently as each finishes

**Given** all five sections are complete,
**When** the SectionProgressBar updates,
**Then** it shows "5 of 5 sections complete" and all SectionCards are green

---

### Story 5.4: Review & Submit Screen

As an Auditor,
I want a clear all-green review screen before submitting, confirming every section is complete,
So that I can submit with certainty — knowing no follow-up calls will be needed for missing data.

**Acceptance Criteria:**

**Given** all 5 sections are complete and the Auditor navigates to Review & Submit,
**When** the page renders,
**Then** all 5 SectionCards are shown in green "Complete" state with field counts; a large primary "Submit Audit" button is visible and enabled

**Given** any section is not yet complete,
**When** the Auditor navigates to Review & Submit,
**Then** the "Submit Audit" button is disabled; incomplete sections are highlighted; tapping one navigates back to it

**Given** any required photo is still uploading or failed,
**When** the Review & Submit screen renders,
**Then** the Submit button remains disabled with: "Waiting for N photo(s) to finish uploading"

**Given** the Auditor taps "Submit Audit",
**When** the AlertDialog confirmation appears,
**Then** it reads "Submit this audit? This action cannot be undone." with "Confirm Submit" and "Cancel" buttons

**Given** the Auditor confirms submission,
**When** POST `/api/v1/audits/:id/submit` is called,
**Then** the audit transitions from DRAFT to IN_REVIEW; the Auditor is navigated to a full-screen confirmation page

---

### Story 5.5: Submission Confirmation & Email Notifications

As an Auditor,
I want a confirmation screen after submission and an email receipt,
So that I know the audit was received successfully and can move on to my next site.

**Acceptance Criteria:**

**Given** the audit submission succeeds,
**When** the confirmation screen renders,
**Then** it shows the store name, audit ID, submission timestamp, and "Your audit has been submitted. Star Energy has been notified."

**Given** the audit transitions to IN_REVIEW,
**When** the API processes the state transition,
**Then** a `cems:email-notification:low` job is enqueued to notify Admin: "New audit submitted — [Store Name], [Auditor Name]" (FR49)

**Given** the audit is submitted,
**When** the email notification job runs,
**Then** a confirmation email is sent to the Auditor: "Your audit for [Store Name] has been received. Reference: [Audit ID]" (FR50)

**Given** the Auditor taps "Return to Store Selector",
**When** navigation occurs,
**Then** the audit app returns to the Store Selector; the submitted audit no longer appears in the Auditor's draft list

---

## Epic 6: Reference Data & System Configuration

Admin can manage the store reference database, maintain the compressor regression database without code changes, and manually enter weather data when external APIs are unavailable.

**FRs covered:** FR43 (admin-side), FR44, FR46, FR47

---

### Story 6.1: Store Reference Data Management

As an Admin,
I want to create, edit, and manage store reference records that auditors see when selecting a store,
So that new client locations can be onboarded and existing records kept accurate without engineering involvement.

**Acceptance Criteria:**

**Given** an Admin opens the Reference Data page and selects "Stores",
**When** GET `/api/v1/stores` is called,
**Then** all stores for the Admin's tenant are listed in a searchable table showing store number, name, banner, region, and assigned auditor count

**Given** an Admin submits POST `/api/v1/stores` with required store fields,
**When** the request is processed,
**Then** a new store record is created and immediately available to auditors in the Store Selector; Redis cache key `store_ref:{storeNumber}` is invalidated

**Given** an Admin edits an existing store record via PATCH `/api/v1/stores/:storeNumber`,
**When** the update is saved,
**Then** the store reference data is updated; the Redis cache entry is invalidated so auditors see fresh data on their next store selection

**Given** an Admin assigns auditors to a store,
**When** the assignment is saved,
**Then** those auditors see the store in their Store Selector; previously assigned auditors who are removed no longer see it

---

### Story 6.2: Compressor Regression Database Management

As an Admin,
I want to add, update, and retire compressor models in the regression database without any code deployments,
So that new compressor models discovered on-site are captured quickly and the calculation engine stays accurate.

**Acceptance Criteria:**

**Given** an Admin opens the Compressor Database section,
**When** GET `/api/v1/compressors` is called,
**Then** all compressor models are listed with model number, manufacturer, refrigerant type, capacity, EER, and status (active / retired)

**Given** an Admin submits POST `/api/v1/compressors` with a new model's regression coefficients,
**When** the request is processed,
**Then** the new model is added; Redis cache key `compressor_db:v{version}` is invalidated and a new version is created; future auditor lookups return the updated model

**Given** an Admin updates an existing compressor record via PATCH `/api/v1/compressors/:model`,
**When** the update is saved,
**Then** the change takes effect without a deployment; existing audits stamped with the previous `compressor_db_version` continue to use the version they were created with

**Given** an Admin retires a compressor model,
**When** the model status is set to "retired",
**Then** the model no longer appears in auditor lookups; existing calculation results using that model are unaffected

**Given** an auditor submitted a new compressor model on-site (Story 3.3),
**When** the Admin views the "Unknown Models" queue,
**Then** the submitted model's specs appear for review; Admin can promote it to the main database in one action

---

### Story 6.3: Weather Data Retrieval & Manual Fallback

As an Admin,
I want weather data to fetch automatically from external APIs, with a manual entry fallback when they're unavailable,
So that energy baseline calculations are never blocked by an external API outage.

**Acceptance Criteria:**

**Given** a calculation job requires degree-day data for a site's postal code,
**When** climate.weather.gc.ca and degreedays.net are called,
**Then** current outdoor temperature and CDD/HDD values are returned and cached in Redis (`weather:{postalCode}:{date}` TTL 6h)

**Given** both weather APIs fail or time out (>5 seconds per NFR-P6),
**When** the calculation job cannot retrieve degree-day data,
**Then** the audit is placed in a `WEATHER_DATA_PENDING` holding state; an in-app alert notifies Admin: "Degree-day data unavailable for [Site]. Enter manually to proceed."

**Given** the Admin enters degree-day values manually via the admin UI (FR47),
**When** PATCH `/api/v1/audits/:id/weather-data` is called,
**Then** the values are saved; the audit automatically re-queues for calculation; the holding state is cleared

**Given** manual degree-day data has been entered,
**When** the calculation runs using that data,
**Then** the calculation result is flagged as "Manual weather data used" in the calculation record — visible in the Admin's calc review panel

---

## Epic 7: Admin Audit Queue & State Machine

Admin can view all audits in a filterable queue, track SLA timers, and drive audits through state transitions from IN_REVIEW through to DELIVERED and CLOSED.

**FRs covered:** FR23 (full state machine), FR24, FR25, FR26, FR27, FR28, FR29

---

### Story 7.1: Audit Queue Table & Status Badges

As an Admin,
I want to see all active audits in a single filterable queue with their current state and SLA status,
So that I can instantly identify which audits need my attention and prioritize my work.

**Acceptance Criteria:**

**Given** an Admin opens the Admin Console,
**When** the Audit Queue page loads,
**Then** GET `/api/v1/audits` returns all audits for the tenant; the table renders with columns: Status, Site Name, Client, Auditor, Submitted At, SLA Timer — in ≤3 seconds for up to 100 records (NFR-P5)

**Given** the audit queue table renders,
**When** each row's AuditStatusBadge renders,
**Then** it shows the correct state label + icon alongside the state color — never color alone (NFR-A2); all 7 states have distinct badge variants

**Given** the queue table renders at the 1024px breakpoint,
**When** inspected,
**Then** only priority columns are visible: Status, Site Name, Auditor, SLA Timer; secondary columns are hidden via `hidden lg:table-cell`

**Given** an Admin applies state and client filters,
**When** filters are selected,
**Then** the table updates to show only matching audits; multiple filters can be combined

**Given** an Admin clicks a row,
**When** the audit detail Sheet opens,
**Then** it slides in from the right without navigating away from the queue page

---

### Story 7.2: SLA Timer & Audit Detail Sheet

As an Admin,
I want to see a live SLA countdown for each audit and review full audit details without leaving the queue,
So that I can triage urgently expiring audits and inspect any submission without losing queue context.

**Acceptance Criteria:**

**Given** an audit is in IN_REVIEW or CALC_COMPLETE state,
**When** the SlaTimer component renders,
**Then** it shows time remaining until the 4-hour SLA target; color changes: green (>3h), amber (1–3h), red (<1h); `aria-label="SLA timer: [time remaining]"` updated per render

**Given** an audit is in FLAGGED state,
**When** the SlaTimer renders,
**Then** it shows "SLA paused" in gray — no countdown (FR27 SLA clock paused at FLAGGED)

**Given** an Admin clicks an audit row,
**When** the Sheet opens,
**Then** the detail panel shows: store name, auditor, submission time, all section completion counts, photo count, current state, and state history timeline — without navigating away from the queue

**Given** the Sheet is open,
**When** the Admin presses Esc or clicks outside,
**Then** the Sheet closes and focus returns to the queue row that opened it

---

### Story 7.3: State Machine Transitions & Audit Log

As an Admin,
I want to advance audits through the state machine with state-appropriate action buttons, and have every transition recorded in an immutable audit log,
So that the workflow is enforced and every state change is traceable with timestamp and actor.

**Acceptance Criteria:**

**Given** an audit is in CALC_COMPLETE state,
**When** the Admin views the audit detail,
**Then** an "Approve" primary button is visible; no "Approve" button appears for audits in any other state (state-scoped actions)

**Given** an Admin clicks "Approve" on a CALC_COMPLETE audit,
**When** POST `/api/v1/audits/:id/transitions` is called with `{ targetState: "APPROVED" }`,
**Then** the server validates the transition is legal; the audit state updates; an audit_log row is inserted with `actorId`, `fromState`, `toState`, `timestamp` (NFR-S4)

**Given** an API call attempts an invalid state transition (e.g., DRAFT to APPROVED),
**When** the audit-state-machine service validates it,
**Then** RFC 7807 409 is returned: "Invalid state transition"

**Given** an Admin archives a DELIVERED audit to CLOSED (FR28),
**When** the transition is processed,
**Then** the audit moves to CLOSED; an audit_log entry is created; the audit becomes immutable

**Given** any state transition occurs,
**When** the audit_log entry is written,
**Then** the audit-log.repo.ts insert-only repository is used — no update or delete methods exist

---

### Story 7.4: Photo Lock Enforcement on State Transition

As an Admin,
I want photos to be locked when an audit moves to IN_REVIEW and become immutable at APPROVED,
So that the photo record supporting a report can never be altered after the review process begins.

**Acceptance Criteria:**

**Given** an audit transitions from DRAFT to IN_REVIEW,
**When** the photo-lifecycle service runs (FR29),
**Then** all Azure Blob SAS tokens for that audit's photos are regenerated as read-only; further upload attempts to those photos return 409 Conflict

**Given** an audit transitions to APPROVED,
**When** the photo-lifecycle service runs,
**Then** the Azure Blob objects for that audit are set to immutable storage policy — no further modifications possible even by the API

**Given** an Admin attempts to delete or replace a photo on an IN_REVIEW audit,
**When** the photo-lifecycle service validates the request,
**Then** RFC 7807 409 is returned: "Photo modification not permitted — audit is in IN_REVIEW or later state"

---

## Epic 8: Calculation Engine & Anomaly Detection

**Goal:** Execute refrigeration ECM savings calculations, build energy baselines via CDD/HDD regression, run LLM anomaly flagging, surface results to auditors and admins, and provide a re-run pathway when inputs change.

**FRs Covered:** FR38, FR39, FR40, FR41, FR42, FR43, FR44, FR45, FR46

---

### Story 8.1: Calculation Pipeline — ECM Refrigeration Savings

**As an** Auditor who has submitted an audit for calculation,
**I want** the system to automatically compute refrigeration ECM savings for each equipment item,
**So that** I receive accurate energy and cost savings estimates without performing manual calculations.

**Acceptance Criteria:**

**Given** an audit transitions to CALC_PENDING (FR38),
**When** the BullMQ `cems:calculation:normal` job is picked up by the calc-service,
**Then** for each refrigeration ECM line item the service computes kWh savings using the approved formula (runtime hours × load reduction × efficiency factor), persists results to `EquipmentCalculation`, and marks the job complete

**Given** the calc-service completes all line items,
**When** results are persisted,
**Then** the audit state machine advances to CALC_COMPLETE and the assigned Auditor receives an in-app notification (FR39)

**Given** a calculation job fails (exception or timeout),
**When** BullMQ exhausts retries (3 attempts, exponential back-off),
**Then** the audit state is set to CALC_ERROR, the error is logged to Azure Monitor, and the Admin console shows a banner with job ID and failure reason (FR38)

**Given** an Auditor views a CALC_COMPLETE audit,
**When** they expand any equipment row,
**Then** per-item kWh savings, cost savings (at site utility rate), and simple payback period are displayed (FR39)

---

### Story 8.2: Calculation Pipeline — Energy Baseline (CDD/HDD Regression)

**As an** Auditor reviewing an audit's calculation results,
**I want** the system to generate a weather-normalised energy baseline using CDD/HDD regression,
**So that** reported savings are adjusted for climate variation and comparable year-over-year.

**Acceptance Criteria:**

**Given** utility interval data and weather data are available for the audit site (FR40),
**When** the baseline job runs inside the calc-service,
**Then** an OLS regression of kWh against CDD and HDD is performed, R² and RMSE are stored in `EnergyBaseline`, and the baseline model coefficients are persisted

**Given** the regression R² is below 0.70,
**When** results are stored,
**Then** a warning flag `LOW_R2` is attached to the baseline record and surfaced in the Admin console review panel (FR40)

**Given** a valid baseline exists,
**When** Auditor views the Baseline tab on the audit detail screen,
**Then** a scatter plot of actual vs. predicted consumption is rendered along with the regression equation and goodness-of-fit metrics (FR41)

**Given** weather data fetch fails (external API timeout),
**When** the baseline job cannot proceed,
**Then** the job is parked in `WEATHER_FETCH_FAILED` status, an alert is raised, and the audit proceeds to CALC_COMPLETE with a "Baseline pending" notice (FR40)

---

### Story 8.3: LLM Anomaly Flagging

**As an** Admin reviewing calculation results,
**I want** the system to run an LLM pass over audit data to surface anomalies and inconsistencies,
**So that** potential data-quality issues are caught before the report is approved.

**Acceptance Criteria:**

**Given** an audit reaches CALC_COMPLETE (FR42),
**When** the `cems:llm-review:normal` BullMQ job runs,
**Then** the LLM receives a structured JSON payload (equipment list, measurements, baseline, ECM line items) and returns an array of `AnomalyFlag` objects: `{field, severity, reason, suggestedValue}`

**Given** the LLM response is received,
**When** flags are persisted to `AuditAnomalyFlag`,
**Then** the Admin console review panel shows each flag with severity badge (HIGH / MEDIUM / LOW), the affected field highlighted, and the LLM's reasoning (FR42)

**Given** the LLM job exceeds 30 s or returns a non-200,
**When** the job fails after 2 retries,
**Then** the audit advances to IN_REVIEW without LLM flags and a "LLM review unavailable" notice is shown to the Admin (FR42)

**Given** an Admin has resolved a flag (accepted or dismissed),
**When** they save the resolution,
**Then** the flag record is updated with `resolvedBy`, `resolvedAt`, and `resolution` enum; the flag is visually marked resolved in the UI (FR42)

---

### Story 8.4: Admin Flag Override & Justification

**As an** Admin reviewing LLM-flagged anomalies,
**I want** to override a flagged value with a corrected value and record my justification,
**So that** the audit record reflects the correct data with a full audit trail.

**Acceptance Criteria:**

**Given** an Admin opens a HIGH or MEDIUM anomaly flag (FR43),
**When** they enter an override value and justification (minimum 20 characters),
**Then** the original value is retained in `AnomalyFlag.originalValue`, the override value is written to the source field, and the override is logged in `AuditLog` with `performedBy`, `timestamp`, and `justification`

**Given** an Admin tries to save an override without justification,
**When** they click Save,
**Then** inline validation blocks submission and displays: "Justification required — minimum 20 characters" (FR43)

**Given** an Admin dismisses a flag without overriding,
**When** they select "Dismiss — data is correct" and confirm,
**Then** the flag is marked `DISMISSED` with their user ID and timestamp; no field value changes (FR43)

**Given** an audit is subsequently exported or reported,
**When** the report is generated,
**Then** all overrides and dismissals appear in an "Admin Adjustments" appendix section of the PDF (FR43)

---

### Story 8.5: Calculation Inputs/Outputs View & Re-run

**As an** Admin or Auditor,
**I want** to view the exact inputs consumed by the calculation engine and trigger a re-run when inputs are corrected,
**So that** I can verify calculation integrity and refresh results after data corrections.

**Acceptance Criteria:**

**Given** a CALC_COMPLETE or CALC_ERROR audit (FR44),
**When** an Admin opens the Calculation Detail panel,
**Then** a read-only table shows every input variable passed to the calc-service (equipment specs, utility rates, weather coefficients) alongside the resulting output values and job metadata (job ID, duration, calc-service version)

**Given** an Auditor corrects a measurement that was used as a calc input (FR45),
**When** the correction is saved,
**Then** the system sets audit state to CALC_STALE and displays a "Recalculation required" banner with a Re-run button

**Given** an Admin clicks Re-run (FR45),
**When** the new `cems:calculation:normal` job is enqueued,
**Then** the previous `EquipmentCalculation` and `EnergyBaseline` records are soft-deleted (archived), the new job runs with the corrected inputs, and results replace the stale values upon completion

**Given** a re-run is in progress,
**When** the Auditor views the audit,
**Then** a progress indicator and job status (QUEUED / RUNNING / COMPLETE) are shown via polling (5 s interval) until the job resolves (FR46)

---

## Epic 9: Report Generation & Publishing

**Goal:** Generate immutable PDF audit reports via Puppeteer, allow Admins to approve and publish, notify clients on publish, and support regeneration when underlying data changes.

**FRs Covered:** FR30, FR31, FR32, FR33, FR52

---

### Story 9.1: PDF Report Generation via Puppeteer

**As an** Admin who has approved an audit,
**I want** the system to automatically generate a branded PDF report,
**So that** a professional, consistent document is ready for client delivery without manual formatting.

**Acceptance Criteria:**

**Given** an audit transitions to APPROVED (FR30),
**When** the `cems:pdf-generation:normal` BullMQ job runs,
**Then** the Puppeteer service renders the audit's React report template (with site logo, equipment table, ECM savings, baseline chart, admin adjustments appendix) as a headless Chromium page, exports to PDF/A, and stores the file in Azure Blob Storage under `reports/{auditId}/v{n}.pdf`

**Given** PDF generation completes,
**When** the blob URL is stored in `AuditReport.blobUrl`,
**Then** the audit state advances to REPORT_READY and an in-app notification is sent to the assigned Admin

**Given** the Puppeteer job fails (crash or timeout > 60 s),
**When** BullMQ exhausts 2 retries,
**Then** audit state is set to REPORT_ERROR, error details logged to Azure Monitor, and the Admin console shows a retry button

**Given** an Admin previews the report,
**When** they open the report preview panel,
**Then** an `<iframe>` renders the PDF blob URL inline; a "Download" button is also available

---

### Story 9.2: Admin Report Approval & Publish

**As an** Admin,
**I want** to review the generated PDF and publish it to the client portal,
**So that** clients only see reports that have been explicitly approved by an administrator.

**Acceptance Criteria:**

**Given** an audit in REPORT_READY state (FR31),
**When** an Admin clicks "Publish to Client Portal",
**Then** the audit state advances to DELIVERED, the `AuditReport.publishedAt` timestamp is set, and the report becomes visible in the client portal (FR34)

**Given** an Admin publishes a report,
**When** the state transition completes,
**Then** the `cems:email-notification:low` BullMQ job is enqueued to send the client their delivery email (FR52)

**Given** an Admin rejects the report before publishing,
**When** they click "Reject — revise required" and enter a reason,
**Then** the audit state reverts to IN_REVIEW, the rejection reason is logged in `AuditLog`, and the assigned Auditor receives an in-app notification to address the issues

**Given** an Admin attempts to publish a report for an audit that has unresolved HIGH-severity anomaly flags,
**When** they click Publish,
**Then** a modal warning lists the unresolved flags and requires explicit confirmation before proceeding (FR43)

---

### Story 9.3: Report Immutability & Version Control

**As a** compliance officer reviewing delivered reports,
**I want** published reports to be immutable and versioned,
**So that** the document a client received can always be reproduced exactly as delivered.

**Acceptance Criteria:**

**Given** a report reaches DELIVERED state (FR32),
**When** the publish action completes,
**Then** the Azure Blob object for `reports/{auditId}/v{n}.pdf` is set to immutable storage policy — no overwrite or delete permitted via the API

**Given** an Admin regenerates a report after post-publish data corrections (FR33),
**When** the new PDF is stored,
**Then** it is written as `v{n+1}.pdf`; the previous version remains accessible; `AuditReport` records all versions with `version`, `generatedAt`, `generatedBy`, and `status` (SUPERSEDED / CURRENT)

**Given** a client requests a previously delivered report version,
**When** the client portal fetches the report,
**Then** only the CURRENT version is shown by default; an Admin can access the version history from the audit detail panel

**Given** any attempt to modify an immutable blob directly (bypassing the API),
**When** Azure Storage rejects the operation,
**Then** the 409 error is surfaced in Azure Monitor and no `AuditReport` record is altered

---

### Story 9.4: Client Email Notification on Publish

**As a** client contact registered to a site,
**I want** to receive an email when my audit report is published,
**So that** I know to log in and review my energy audit results without having to check the portal manually.

**Acceptance Criteria:**

**Given** the `cems:email-notification:low` job runs after report publish (FR52),
**When** the email service resolves the client contacts for the audit's organisation,
**Then** each contact with `receiveReportNotifications: true` receives an email with subject "Your Star Energy Audit Report is Ready", a deep link to the portal report page, and the site address and audit reference number

**Given** an email send fails (SMTP error or invalid address),
**When** the job logs the failure,
**Then** the failure is recorded in `EmailLog` with `recipientEmail`, `errorCode`, `timestamp`; the job does not retry the failed address but continues to remaining recipients

**Given** a client does not have a portal account yet,
**When** the notification email is sent,
**Then** the email includes a "Create your account" CTA linking to the portal registration flow with the site pre-populated

**Given** an Admin views an audit's notification log,
**When** they open the Notifications tab,
**Then** a table shows each recipient, sent/failed status, and timestamp for all notification attempts on that audit

---

### Story 9.5: Report Regeneration After Data Correction

**As an** Admin,
**I want** to regenerate a published report when underlying audit data has been corrected post-delivery,
**So that** the client receives an updated, accurate document with a clear indication it supersedes the prior version.

**Acceptance Criteria:**

**Given** a DELIVERED audit has a data correction applied (FR33),
**When** an Admin clicks "Regenerate Report" and confirms,
**Then** a new `cems:pdf-generation:normal` job is enqueued, the new PDF is stored as `v{n+1}` (immutable), and the prior version is marked SUPERSEDED

**Given** the regenerated PDF is ready,
**When** an Admin publishes it,
**Then** the client portal replaces the displayed report with the new version, the client receives a notification email with subject "Updated Audit Report Available — [Site Name]", and the version history panel shows both versions

**Given** an Admin views the audit after regeneration,
**When** the version history panel is open,
**Then** each version row shows: version number, generated date, generated by, publish date, and status badge (CURRENT / SUPERSEDED)

**Given** the regeneration job fails,
**When** BullMQ exhausts retries,
**Then** the audit remains in DELIVERED state, REPORT_ERROR is logged, and an Admin banner surfaces the failure with a manual retry option

---

## Epic 10: Client Portal

**Goal:** Give clients a self-service portal to view their published reports, track audit status, manage site contacts, and download deliverables — all scoped to their organisation via Row-Level Security.

**FRs Covered:** FR34, FR35, FR36, FR37 + UX-DR11, UX-DR18

---

### Story 10.1: Client Portal — Dashboard & Audit Status Tracker

**As a** client user,
**I want** to log in and see all audits for my organisation with their current status,
**So that** I can track progress without emailing Star Energy for updates.

**Acceptance Criteria:**

**Given** a client user authenticates (JWT, 4 h TTL) (FR34),
**When** they land on the portal dashboard,
**Then** the dashboard lists all audits for their organisation (scoped by Azure SQL RLS via `SESSION_CONTEXT`) with site name, audit date, assigned auditor name, current state badge, and last-updated timestamp

**Given** the client has multiple sites,
**When** they view the dashboard,
**Then** a site filter dropdown lets them narrow to a single site; the default view shows all sites sorted by most-recent activity (UX-DR11)

**Given** an audit transitions state (e.g., DELIVERED),
**When** the client next loads the dashboard (or if they are active and poll fires at 60 s),
**Then** the updated state badge is reflected without a manual refresh

**Given** a client user attempts to access an audit not belonging to their organisation,
**When** the API resolves the request,
**Then** Azure SQL RLS returns no rows and the API returns 404 Not Found — the client sees no indication the audit exists (FR34)

---

### Story 10.2: Client Portal — Report Viewing & Download

**As a** client user,
**I want** to view and download my published audit report from the portal,
**So that** I have on-demand access to my energy audit deliverable without waiting for email attachments.

**Acceptance Criteria:**

**Given** an audit is in DELIVERED state (FR35),
**When** the client opens the audit detail page,
**Then** the current report version is displayed in an `<iframe>` PDF viewer and a "Download PDF" button is available; superseded versions are not shown to the client

**Given** the client clicks "Download PDF",
**When** the download is triggered,
**Then** a time-limited (15 min) Azure Blob SAS URL is generated server-side and the browser initiates the download — the permanent blob URL is never exposed to the client (FR35)

**Given** an audit is in a pre-DELIVERED state (e.g., IN_REVIEW, CALC_COMPLETE),
**When** the client views that audit,
**Then** the report section shows a status message ("Your report is being prepared") with no download option (FR35)

**Given** a client navigates to a report deep link from the notification email,
**When** they are not yet authenticated,
**Then** they are redirected to login; after successful login they are returned to the report page (UX-DR18)

---

### Story 10.3: Client Portal — ECM Savings Summary View

**As a** client user reviewing my audit report,
**I want** to see an interactive summary of recommended ECM savings,
**So that** I can quickly understand the financial and energy impact without reading the full PDF.

**Acceptance Criteria:**

**Given** a client opens a DELIVERED audit (FR36),
**When** they select the "Savings Summary" tab,
**Then** a table lists each ECM line item with: equipment name, annual kWh savings, annual cost savings (at site utility rate), simple payback period, and priority tier (High / Medium / Low)

**Given** the savings summary table loads,
**When** it contains more than 10 rows,
**Then** pagination (10 rows/page) and a column sort control are available; sort defaults to highest cost savings first

**Given** the client views the savings summary,
**When** the page renders,
**Then** a totals row at the bottom shows aggregated kWh savings, total cost savings, and average payback period across all ECMs (FR36)

**Given** the client's browser is offline (progressive web app context),
**When** they attempt to load the savings summary,
**Then** cached data from the last successful fetch is shown with an "Offline — data as of [timestamp]" banner; no stale data is served without the banner (UX-DR18)

---

### Story 10.4: Client Portal — Contact & Notification Management

**As a** client organisation admin,
**I want** to manage which contacts receive report notifications and can access the portal,
**So that** the right people are informed when audits are delivered.

**Acceptance Criteria:**

**Given** a client user with `ORGANISATION_ADMIN` role opens Settings → Contacts (FR37),
**When** the page loads,
**Then** a table lists all contacts for their organisation with: name, email, role, `receiveReportNotifications` toggle, and last login date

**Given** an org admin toggles `receiveReportNotifications` for a contact,
**When** they save,
**Then** the preference is persisted and the change is reflected in subsequent `cems:email-notification:low` job recipient resolution (FR37, FR52)

**Given** an org admin invites a new contact (name + email),
**When** the invitation is submitted,
**Then** an invitation email is sent with a portal registration link scoped to their organisation; the contact appears in the table with status "Invited" until they register (FR37)

**Given** an org admin removes a contact,
**When** they confirm deletion,
**Then** the contact's portal access is revoked, their active JWT is invalidated via the token blocklist, and they are removed from future notification jobs (FR37)
