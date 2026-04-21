---
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8]
lastStep: 8
status: 'complete'
completedAt: '2026-04-19'
inputDocuments:
  - '_bmad-output/planning-artifacts/prd.md'
workflowType: 'architecture'
project_name: 'Star Energy CEMS'
user_name: 'Abhishek'
date: '2026-04-19'
---

# Architecture Decision Document

_This document builds collaboratively through step-by-step discovery. Sections are appended as we work through each architectural decision together._

## Project Context Analysis

### Requirements Overview

**Functional Requirements:**

57 FRs across 10 capability areas define three distinct product surfaces:

- **Site Audit App** (FR1–FR15, FR45, FR48, FR54–FR57): A guided, sequential mobile form engine with per-screen field validation, device camera integration, auto-tagged photo capture, auto-save on every field change, and draft resume from any device. The audit workflow follows a deep equipment hierarchy (5 system sections; refrigeration alone has 8 nested sub-levels). Supports concurrent multi-auditor access with section-level polling-based locking (MVP) and SSE upgrade (Post-MVP). Auto-save frequency, photo upload queue management, and section lock polling are first-class concerns.
- **Calculation & LLM Pipeline** (FR16–FR22): An async multi-step calculation pipeline — audit data triggers ECM refrigeration savings calculations and weather-normalized energy baseline analysis (CDD/HDD regression), outputs reviewed by Claude for anomalies, flagged items require human override with justification trail before advancing. Every calculation stored with full input snapshot for reproducibility.
- **Admin Console** (FR23–FR33, FR39–FR40, FR43–FR44, FR47): Desktop workflow managing an audit queue across 7 states, driving the calculation/LLM review loop, configuring reference data (compressor DB, store data), and triggering server-side PDF report generation.
- **Client Portal** (FR34–FR37): Read-only dashboard + PDF download with row-level data isolation. Security-critical by nature.
- **Reference Data & Config** (FR43–FR48): Admin-configurable compressor regression DB (no-code updates), store reference data, degree-day manual fallback. Compressor DB is a live evolving asset — updates must not require deployments.
- **Notifications** (FR49–FR53): Transactional email and in-app alerts. SLA clock pauses and restores with state transitions.

**Non-Functional Requirements (architecturally significant):**

| NFR | Architectural Implication |
|---|---|
| NFR-P1: ≤2s screen transitions on 4G | API ≤500ms; bundle optimization; CDN for static assets |
| NFR-P2: Auto-save non-blocking | Optimistic UI + debounced background writes; no spinner on save |
| NFR-P3: 60s calculation engine | Async job queue; polling/SSE for completion; no synchronous HTTP timeout |
| NFR-P4: 5min PDF generation | Async job queue; status polling or SSE |
| NFR-S3: Azure SQL RLS | All DB queries via RLS-enforced connection contexts |
| NFR-S4: Immutable audit log | Append-only `audit_log` table |
| NFR-R2: Zero data loss on disconnect | Server-confirmed auto-save; local queue as buffer |
| NFR-R3: Calculation reproducibility | Input snapshot stored with every calculation run |
| NFR-SC3: Tenant-scoped from Day 1 | `tenant_id` on all entities; RLS policies; API enforces tenant context |

**Scale & Complexity:**

- Primary domain: Full-stack (mobile-first web + desktop web + async calculation API + PDF generation service)
- Complexity level: **High / Enterprise**
- Concurrent users at launch: 20 active audit projects (4 of which may have 2 concurrent auditors)
- Scale to 100 concurrent projects at 12 months — infrastructure-only changes

### Technical Constraints & Dependencies

| Constraint | Impact |
|---|---|
| Azure cloud (Canadian region, TBC) | All infrastructure on Azure |
| Azure SQL with Row-Level Security | ORM must support RLS context-setting; no raw query bypasses |
| Azure Blob Storage | State-gated photo access (locked at IN_REVIEW, immutable at APPROVED) |
| Browser-based device APIs only (MVP) | MediaDevices, Geolocation, File API — no native SDK |
| No offline mode (MVP) | No service worker / IndexedDB sync required at MVP |
| Claude API (30s timeout) | Async with fallback to manual-review holding state |
| Star Energy Compressor Regression DB | Internal, admin-managed, no-code updates; config-driven not code-driven |
| Canadian weather APIs only (MVP) | climate.weather.gc.ca + degreedays.net; fallback = Admin manual entry |
| API v1 prefix from Day 1 | Versioned REST API for future native apps + multi-tenancy |
| Form + compressor DB version stamping | Schema versioning on every audit submission |
| Chart-to-PDF rendering | **Unresolved** — headless browser vs. server-side chart lib; decided in architecture |

### Cross-Cutting Concerns Identified

1. **Authentication & Authorization** — JWT-based; role from token; Azure SQL RLS context set per request
2. **Audit State Machine Enforcement** — Server-side state service; invalid transitions rejected at API
3. **High-Frequency Auto-Save** — Debounced field-level writes; server-confirmed; resume from server state
4. **Async Job Pipeline** — Calculation engine and PDF generation are async; job queue + polling/SSE
5. **Photo Lifecycle Management** — Azure Blob; state-gated SAS tokens; immutability at APPROVED
6. **Calculation Versioning & Reproducibility** — Input snapshots stored; re-run creates new immutable record
7. **Section-Level Locking (Multi-Auditor)** — `audit_section_locks` table Day 1; polling MVP; SSE Post-MVP; heartbeat-based lock expiry
8. **Tenant Isolation** — `tenant_id` on all entities; RLS; Day 1 even with 1 tenant at MVP
9. **External API Resilience** — Timeout + fallback pattern for all 7 integrations
10. **LLM Integration** — Async Claude call in calc pipeline; 30s timeout; unavailability → manual-review state
11. **Report Generation Pipeline** — Async: audit data + calculations → chart render → PDF → Azure Blob → email notification

## Starter Template Evaluation

### Primary Technology Domain

Full-stack: 3 frontend SPAs + 1 TypeScript REST API + 1 Python calculation microservice.
LLM-first development (Claude Code) — all library choices optimized for maximum TypeScript type safety, highest LLM training data coverage, and clear module boundaries.

### Selected Architecture: Turborepo Monorepo

**Initialization Command:**

```bash
npx create-turbo@latest cems --package-manager pnpm
```

**Monorepo Structure:**

```
cems/
├── apps/
│   ├── audit-app/        # Site Audit App — mobile-first, field auditors
│   ├── admin-app/        # Admin Console — Star Energy office staff
│   ├── client-portal/    # Client Portal — Sobeys/Metro read-only
│   ├── api/              # REST API — Fastify + Prisma
│   └── calc-service/     # Calculation Engine — Python + FastAPI
├── packages/
│   ├── ui/               # Shared component library (Tailwind + shadcn/ui)
│   ├── types/            # Shared TypeScript types (audit, user, calculation)
│   ├── db/               # Prisma schema + generated client
│   └── config/           # Shared ESLint, TypeScript, Tailwind configs
└── turbo.json
```

### Technology Stack

**Frontend (all 3 apps): React 19 + Vite 6 + TypeScript**

```bash
pnpm create vite@latest audit-app --template react-ts
```

| Library | Version | Purpose |
|---|---|---|
| React + Vite | 19 / 6 | UI framework + build |
| Tailwind CSS | 4 | Styling |
| shadcn/ui | latest | Component library |
| TanStack Query | v5 | Server state / data fetching |
| React Hook Form + Zod | latest | Form validation (complex audit forms) |
| React Router | v7 | Routing |

**Backend API: Node.js 22 + Fastify 5.8.5 + TypeScript**

| Library | Version | Purpose |
|---|---|---|
| Fastify | 5.8.5 | HTTP framework |
| Prisma | 7.5.0 | ORM — Azure SQL via `@prisma/adapter-mssql` |
| BullMQ | 5.74.1 | Async job queue (calc + PDF jobs) — Azure Cache for Redis |
| Puppeteer | 24.35.0 | PDF generation — renders React components via headless Chrome |
| Zod | latest | Validation — shared schemas with frontend via `packages/types` |
| @azure/storage-blob | latest | Photo storage |
| Resend | latest | Transactional email |
| jose (JWT) | latest | Authentication — role embedded in token |

**Calculation Service: Python 3.12 + FastAPI**

Internal microservice called by the API. Handles ECM refrigeration savings, energy baseline (CDD/HDD regression), and refrigerant temp-to-pressure conversions.

```bash
pip install fastapi uvicorn numpy pandas pydantic
```

**Testing:** Vitest + React Testing Library (frontend) · Vitest + Supertest (API) · pytest (calc service)

### Chart-to-PDF Risk Resolution

**Decision: Puppeteer 24.35.0 (headless Chrome)**

1. `ReportTemplate` React component in admin-app renders the full report with charts using real audit data
2. API Puppeteer worker renders the template server-side → `page.pdf()` → streams to Azure Blob
3. No separate server-side chart library — same React + Tailwind code used for preview and PDF
4. Performance: 0.8–1.2s per PDF; 50–100 PDFs/sec on modern hardware

**Post-MVP upgrade:** SSE replaces polling for section locks — no schema migration required.

**Note:** Monorepo initialization is the first story in Epic 1.

## Core Architectural Decisions

### Category 1: Data Architecture

**Hybrid Audit Data Model**

Audit data uses a hybrid approach: relational tables for structured equipment entities (compressors, racks, condensers, walk-ins, display cases) and JSON columns for flat-field sections (General, Building Envelope, HVAC, Lighting) where data is captured as typed key-value pairs with no complex relationships.

| Section | Storage | Rationale |
|---|---|---|
| General (1.01–1.11) | `audits.general_data NVARCHAR(MAX)` JSON column | ~25 fields, no joins needed, schema evolves with form versions |
| Refrigeration Machine Room | `machine_rooms` table | Contains sub-entities (racks → compressors, etc.) |
| Rack / Compressor / Walk-In / Display Case | Relational tables per entity type | Deep hierarchy, equipment-level calculations depend on these |
| HVAC | `audits.hvac_data` JSON column | Flat field set, no equipment sub-hierarchy |
| Lighting | `audits.lighting_data` JSON column | Flat field set |
| Building Envelope | `audits.building_envelope_data` JSON column | Flat field set |

Form version and compressor DB version stamped on every audit row (`form_version`, `compressor_db_version`).

**Redis Caching Strategy (Azure Cache for Redis C0 → C1)**

| Cache Key | TTL | Content |
|---|---|---|
| `compressor_db:v{version}` | 24h | Full compressor regression DB snapshot (admin-updated, versioned) |
| `section_lock:{audit_id}:{section_id}` | 90s | Auditor ID + timestamp (heartbeat resets TTL) |
| `store_ref:{store_number}` | 1h | Store reference data (name, address, banner, region) |
| `weather:{postal_code}:{date}` | 6h | Current outdoor temp from climate.weather.gc.ca |

**Database Migrations: Prisma Migrate**

All schema changes via `prisma migrate dev` (development) / `prisma migrate deploy` (CI/CD). Migration files committed to version control. No manual SQL DDL outside migrations.

---

### Category 2: Authentication & Security

**JWT Token Strategy**

| Role | Access Token TTL | Refresh Token TTL | Rationale |
|---|---|---|---|
| Auditor | 8 hours | 7 days | Field audits are 4–6 hour sessions; 8h prevents mid-audit expiry |
| Admin | 4 hours | 1 day | Office-based; standard business session length |
| Client | 4 hours | 1 day | Portal access is brief and infrequent |

Refresh tokens stored in `user_sessions` table (hashed). Rotation on every refresh. Revocation via `sessions` table delete.

**Azure SQL Row-Level Security via SESSION_CONTEXT**

Prisma middleware sets `SESSION_CONTEXT` before every query:

```typescript
// packages/db/src/middleware/rls.ts
prisma.$use(async (params, next) => {
  await prisma.$executeRaw`
    EXEC sp_set_session_context 'tenant_id', ${ctx.tenantId};
    EXEC sp_set_session_context 'user_id', ${ctx.userId};
    EXEC sp_set_session_context 'user_role', ${ctx.role};
  `;
  return next(params);
});
```

All tables have RLS policies filtering on `SESSION_CONTEXT('tenant_id')`. Client role additionally filtered by `assigned_store_ids`.

**No Azure AD (MVP)** — email/password auth only. Azure AD SSO is Post-MVP.

---

### Category 3: API & Communication

**OpenAPI 3.0 via `@fastify/swagger` + `@fastify/swagger-ui`**

Every route decorated with JSON Schema (Zod → converted via `zod-to-json-schema`). OpenAPI spec auto-generated and served at `/api/v1/docs`. Shared types package (`packages/types`) ensures frontend and API use identical request/response shapes.

**RFC 7807 Problem Details — Standardized Error Format**

```json
{
  "type": "https://cems.starenergy.ca/errors/validation-error",
  "title": "Validation Failed",
  "status": 422,
  "detail": "Field 'grossArea' must be a positive number",
  "instance": "/api/v1/audits/abc123/sections/general",
  "errors": [{ "field": "grossArea", "message": "Must be positive" }]
}
```

**Calc Service Communication: Internal HTTP over Azure VNet**

API → Calc Service via `http://calc-service:8000` (Azure Container Apps internal ingress). No public exposure of calc service. 30s timeout with circuit breaker. On timeout/unavailability: audit transitions to `MANUAL_REVIEW_REQUIRED` holding state.

---

### Category 4: Frontend Architecture

**State Management: Zustand + TanStack Query (no Redux)**

- **TanStack Query**: All server state (audit data, reference data, job status polling)
- **Zustand**: UI-only local state (current section, unsaved field values, photo upload queue, section lock status)
- No global Redux store — complexity not justified for 3 SPAs at this scale

**URL-Driven Audit Wizard Navigation**

```
/audit/:auditId/section/:sectionId
/audit/:auditId/section/refrigeration/rack/:rackId/compressor/:compressorId
```

Every screen has a stable URL. Browser back/forward works. Deep link resume from any device navigates directly to last incomplete section (stored server-side as `current_section_id`).

**Mobile-First Implementation (audit-app)**

- Viewport: `<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">` — prevents zoom on input focus
- Camera: `navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })` — rear camera default
- Touch targets: minimum 44×44pt enforced via Tailwind `min-h-[44px] min-w-[44px]` utility classes
- Auto-save: 800ms debounce on field change → PATCH `/api/v1/audits/:id/sections/:sectionId` → optimistic UI (no spinner)

---

### Category 5: Infrastructure & Deployment

**Azure Services Topology (Canada Central — `canadacentral`)**

| Service | Tier | Purpose |
|---|---|---|
| Azure Static Web Apps | Free (Standard Post-MVP) | audit-app, admin-app, client-portal; global CDN |
| Azure App Service | B2 (dev/staging), B3 (prod) | Node.js API (Fastify) |
| Azure Container Apps | Consumption | Python FastAPI calc service; scales to zero |
| Azure SQL Database | S2 (50 DTU) | Primary database; upgrade path to S4/P1 |
| Azure Cache for Redis | C0 (dev), C1 (prod) | BullMQ job queue + application caching |
| Azure Blob Storage | LRS | Audit photos + generated PDF reports |
| Azure Key Vault | Standard | All secrets (DB connection strings, JWT secret, API keys) |
| Azure Application Insights | Pay-as-you-go | Distributed tracing; Pino → Application Insights transport |

**Three Environments: dev / staging / prod**

All environments in Canada Central. Staging is production-mirror (same SKUs, separate data). GitHub Actions deploys on push to `main` (staging) and manual approval gate to prod.

**CI/CD: GitHub Actions + Turborepo Remote Cache**

```yaml
# Turborepo detects changed packages — only rebuilds/retests affected apps
turbo run build test lint --filter=[HEAD^1]
```

Pipeline: lint → type-check → test → build → deploy. Pull request previews via Azure Static Web Apps preview URLs. API deployed via `az webapp deploy` with slot swap (zero-downtime).

**Observability: Pino + Application Insights**

Structured JSON logs (Pino) shipped to Application Insights via `applicationinsights` SDK. Every API request logged with `tenant_id`, `user_id`, `route`, `duration_ms`. BullMQ job lifecycle events (queued, started, completed, failed) logged as custom events. Alert rules: API p95 latency > 800ms, job failure rate > 5%, Redis connection failures.

## Implementation Patterns & Consistency Rules

**6 conflict zones identified** where independent AI agents could make different, incompatible choices without explicit rules.

### Naming Patterns

**Database (Prisma schema → Azure SQL)**

| Convention | Rule | Example |
|---|---|---|
| Table names | `snake_case`, plural | `audit_sections`, `compressor_refs` |
| Column names | `snake_case` | `tenant_id`, `created_at`, `gross_area_sqft` |
| Foreign keys | `{table_singular}_id` | `audit_id`, `rack_id`, `user_id` |
| Indexes | `idx_{table}_{columns}` | `idx_audits_tenant_id`, `idx_section_locks_audit_id` |
| Enum values | `SCREAMING_SNAKE_CASE` | `DRAFT`, `IN_REVIEW`, `CALC_COMPLETE` |

**REST API Endpoints**

| Convention | Rule | Example |
|---|---|---|
| Resource paths | Plural nouns | `/api/v1/audits`, `/api/v1/users` |
| Nested resources | Max 2 levels | `/api/v1/audits/:auditId/sections/:sectionId` |
| Query params | `camelCase` | `?storeNumber=123&pageSize=25` |
| Custom headers | `X-CEMS-{Name}` | `X-CEMS-Tenant-Id`, `X-CEMS-Request-Id` |

**TypeScript / Frontend Code**

| Convention | Rule | Example |
|---|---|---|
| Component files | `PascalCase.tsx` | `AuditWizard.tsx`, `CompressorForm.tsx` |
| Utility files | `camelCase.ts` | `formatDate.ts`, `validateSection.ts` |
| Variables/functions | `camelCase` | `auditId`, `getUserById` |
| Constants | `SCREAMING_SNAKE_CASE` | `MAX_PHOTO_SIZE_MB`, `LOCK_HEARTBEAT_MS` |
| Zustand stores | `use{Name}Store` | `useAuditStore`, `usePhotoUploadStore` |
| TanStack Query keys | Array tuples | `['audits', auditId, 'section', sectionId]` |

### Structure Patterns

**Frontend feature module layout (all 3 apps):**

```
apps/audit-app/src/
├── pages/          # Route-level components (one per route)
├── features/       # Feature modules (audit/, photos/, auth/)
│   └── audit/
│       ├── components/   # UI components for this feature
│       ├── hooks/        # Feature-specific React hooks
│       ├── stores/       # Zustand stores for this feature
│       └── api.ts        # TanStack Query hooks + fetch functions
├── components/     # Truly shared UI (Button, Modal, etc.)
├── lib/            # Non-UI utilities (formatters, validators)
└── main.tsx
```

**Tests: Co-located with source** — `SectionForm.tsx` + `SectionForm.test.tsx` in the same directory. No separate `__tests__/` folders.

**API service layer:**

```
apps/api/src/
├── routes/         # Fastify route handlers (thin — validate, call service, respond)
├── services/       # Business logic (audit-state-machine, calc-pipeline, etc.)
├── repositories/   # Prisma query functions (no business logic)
├── jobs/           # BullMQ job processors
├── middleware/     # Auth, RLS context, global error handler
└── lib/            # Shared utilities (azure-blob, resend, etc.)
```

### Format Patterns

**API Response Formats**

Success — direct data (no wrapper envelope):
```json
// Single resource
{ "id": "audit_abc123", "storeNumber": "1042", "status": "DRAFT", "createdAt": "2026-04-19T10:00:00Z" }

// List resource
{ "items": [...], "total": 47, "page": 1, "pageSize": 25 }
```

Async job enqueued — 202 Accepted:
```json
{ "jobId": "job_xyz789", "status": "QUEUED", "pollUrl": "/api/v1/jobs/job_xyz789" }
```

Errors — RFC 7807 (all errors):
```json
{ "type": "https://cems.starenergy.ca/errors/validation-error", "title": "Validation Failed", "status": 422, "detail": "..." }
```

**Date format:** ISO 8601 UTC strings everywhere (`2026-04-19T10:00:00Z`). Frontend formats for display via `Intl.DateTimeFormat`.

**JSON field naming:** `camelCase` in all API requests and responses. Prisma snake_case columns mapped to camelCase at the repository layer.

### Communication Patterns

**BullMQ Job naming convention:** `cems:{job-type}:{priority}`

```
cems:calculation:normal
cems:pdf-generation:normal
cems:email-notification:low
```

**Zustand store design — flat and focused, one store per concern:**

```typescript
useAuditStore       // { currentSectionId, dirtyFields, autoSaveStatus }
usePhotoUploadStore // { queue: PhotoUploadItem[], retryCount }
useSectionLockStore // { locks: Record<sectionId, LockInfo>, heartbeatIntervalId }
```

No inter-store communication via events — components read from multiple stores directly.

**SSE event names (Post-MVP section locks — naming defined now for schema alignment):**

```
section_lock.acquired   { auditId, sectionId, lockedBy, expiresAt }
section_lock.released   { auditId, sectionId }
section_lock.expired    { auditId, sectionId }
```

### Process Patterns

**Error Handling — Layered**

| Layer | Pattern |
|---|---|
| React components | TanStack Query `isError` state → inline error UI; no try/catch in components |
| TanStack Query | `retry: 2` for GETs, `retry: 0` for mutations |
| Fastify routes | All errors thrown as `fastify.httpErrors.{type}()` — never raw `new Error()` |
| Services | Typed error classes thrown; caught by global Fastify error handler |
| BullMQ jobs | `attempts: 3`, exponential backoff; `onFailed` → log + update job status in DB |
| Calc service calls | `p-retry` wrapper; on failure → set audit to `MANUAL_REVIEW_REQUIRED` |

**Auto-Save Pattern (audit-app):**
```
Field change → debounce 800ms → PATCH section → optimistic UI (no spinner)
                                              ↘ on error: queue retry + subtle "Save failed" badge
```

**Loading States — 3 levels only:**
1. `isLoading` (TanStack Query) — initial fetch, skeleton UI
2. `isSaving` (Zustand) — auto-save in progress, subtle indicator only
3. `isSubmitting` (form) — section submit, button disabled

No spinner overlays on auto-save. No full-page loaders except initial app load.

### Enforcement Guidelines

**All AI Agents MUST:**

1. Use `snake_case` for all database columns; `camelCase` for all TypeScript/API fields
2. Place business logic in `services/` — never in route handlers or React components
3. Return RFC 7807 error format from every API error response
4. Use TanStack Query for all server state — no `useState` + `useEffect` fetch patterns
5. Never bypass Prisma RLS middleware — no `$queryRaw` without explicit `SESSION_CONTEXT` set
6. Co-locate test files with source files
7. Never commit secrets — all secrets via Azure Key Vault injected as runtime environment variables

**Anti-Patterns (explicitly forbidden):**
- `useEffect(() => { fetch(...) }, [])` — use TanStack Query instead
- Business logic inside Fastify route handlers
- Direct Prisma calls from route handlers (must go through repository layer)
- `console.log` — use Pino logger instance
- Inline SQL strings — use Prisma query API or tagged template literals only

## Project Structure & Boundaries

### Complete Project Directory Structure

```
cems/
├── .github/
│   └── workflows/
│       ├── ci.yml                    # PR checks: lint, type-check, test (Turborepo filtered)
│       ├── deploy-staging.yml        # Push to main → staging deploy
│       └── deploy-prod.yml           # Manual approval gate → prod deploy
├── apps/
│   ├── audit-app/                    # Mobile-first PWA — field auditors
│   │   ├── public/
│   │   │   └── sample-photos/        # Reference sample images (bundled, shown in help UI)
│   │   ├── src/
│   │   │   ├── main.tsx
│   │   │   ├── App.tsx               # Router setup, auth guard, TanStack Query provider
│   │   │   ├── pages/
│   │   │   │   ├── LoginPage.tsx
│   │   │   │   ├── StoreSelectorPage.tsx
│   │   │   │   ├── AuditSectionPage.tsx   # Route: /audit/:auditId/section/:sectionId
│   │   │   │   └── AuditCompletePage.tsx
│   │   │   ├── features/
│   │   │   │   ├── auth/
│   │   │   │   │   ├── components/        # LoginForm.tsx, OtpForm.tsx
│   │   │   │   │   ├── hooks/             # useAuth.ts
│   │   │   │   │   ├── stores/            # authStore.ts
│   │   │   │   │   └── api.ts             # login, refresh, logout mutations
│   │   │   │   ├── audit/                 # FR1–FR10: Audit data collection
│   │   │   │   │   ├── components/
│   │   │   │   │   │   ├── AuditWizard.tsx
│   │   │   │   │   │   ├── SectionProgress.tsx
│   │   │   │   │   │   ├── FieldHelpTooltip.tsx
│   │   │   │   │   │   ├── AutoSaveIndicator.tsx
│   │   │   │   │   │   └── sections/
│   │   │   │   │   │       ├── GeneralSection.tsx          # Screens 1.01–1.11
│   │   │   │   │   │       ├── MachineRoomSection.tsx      # Screen 2.1
│   │   │   │   │   │       ├── RackSection.tsx             # Screen 2.2
│   │   │   │   │   │       ├── CompressorSection.tsx       # Screen 2.3
│   │   │   │   │   │       ├── ConventionalUnitSection.tsx # Screen 2.4
│   │   │   │   │   │       ├── CondenserSection.tsx        # Screen 2.5
│   │   │   │   │   │       ├── WalkInSection.tsx           # Screen 2.6
│   │   │   │   │   │       ├── DisplayCaseSection.tsx      # Screen 2.7
│   │   │   │   │   │       ├── ControllerSection.tsx       # Screen 2.8
│   │   │   │   │   │       ├── HvacSection.tsx             # Screen 3
│   │   │   │   │   │       ├── LightingSection.tsx         # Screen 4
│   │   │   │   │   │       └── BuildingEnvelopeSection.tsx # Screen 5
│   │   │   │   │   ├── hooks/
│   │   │   │   │   │   ├── useAutoSave.ts
│   │   │   │   │   │   └── useSectionNavigation.ts
│   │   │   │   │   ├── stores/
│   │   │   │   │   │   └── auditStore.ts
│   │   │   │   │   └── api.ts
│   │   │   │   ├── photos/                # FR11–FR15: Photo capture & management
│   │   │   │   │   ├── components/
│   │   │   │   │   │   ├── CameraCapture.tsx
│   │   │   │   │   │   ├── PhotoPreview.tsx
│   │   │   │   │   │   ├── PhotoComment.tsx
│   │   │   │   │   │   └── UploadStatusBadge.tsx
│   │   │   │   │   ├── hooks/
│   │   │   │   │   │   └── usePhotoUpload.ts
│   │   │   │   │   ├── stores/
│   │   │   │   │   │   └── photoUploadStore.ts
│   │   │   │   │   └── api.ts
│   │   │   │   └── section-locks/         # FR54–FR57: Multi-auditor locking
│   │   │   │       ├── components/
│   │   │   │       │   └── SectionLockedBanner.tsx
│   │   │   │       ├── hooks/
│   │   │   │       │   └── useSectionLock.ts
│   │   │   │       ├── stores/
│   │   │   │       │   └── sectionLockStore.ts
│   │   │   │       └── api.ts
│   │   │   ├── components/
│   │   │   │   ├── TouchButton.tsx
│   │   │   │   ├── FormField.tsx
│   │   │   │   ├── DropdownSelect.tsx
│   │   │   │   └── OfflineAlert.tsx
│   │   │   └── lib/
│   │   │       ├── queryClient.ts
│   │   │       └── api-client.ts
│   │   ├── index.html
│   │   ├── vite.config.ts
│   │   ├── tsconfig.json
│   │   └── package.json
│   │
│   ├── admin-app/                    # Desktop SPA — Star Energy office staff
│   │   ├── src/
│   │   │   ├── main.tsx
│   │   │   ├── App.tsx
│   │   │   ├── pages/
│   │   │   │   ├── LoginPage.tsx
│   │   │   │   ├── AuditQueuePage.tsx
│   │   │   │   ├── AuditDetailPage.tsx
│   │   │   │   ├── CalculationReviewPage.tsx
│   │   │   │   ├── ReportPreviewPage.tsx
│   │   │   │   ├── UsersPage.tsx
│   │   │   │   └── ReferenceDataPage.tsx
│   │   │   ├── features/
│   │   │   │   ├── audit-queue/           # FR23–FR29: Workflow & state machine
│   │   │   │   │   ├── components/
│   │   │   │   │   │   ├── AuditQueueTable.tsx
│   │   │   │   │   │   ├── AuditStatusBadge.tsx
│   │   │   │   │   │   ├── StateTransitionButton.tsx
│   │   │   │   │   │   └── SlaTimer.tsx
│   │   │   │   │   └── api.ts
│   │   │   │   ├── calc-review/           # FR16–FR22: Calculation engine + LLM review
│   │   │   │   │   ├── components/
│   │   │   │   │   │   ├── CalcResultsPanel.tsx
│   │   │   │   │   │   ├── LlmFlagCard.tsx
│   │   │   │   │   │   ├── OverrideForm.tsx
│   │   │   │   │   │   └── JobStatusPoller.tsx
│   │   │   │   │   └── api.ts
│   │   │   │   ├── reports/               # FR30–FR33: Report generation & distribution
│   │   │   │   │   ├── components/
│   │   │   │   │   │   ├── ReportTemplate.tsx       # Also rendered by Puppeteer server-side
│   │   │   │   │   │   ├── EnergyBaselineChart.tsx
│   │   │   │   │   │   ├── SavingsProjectionChart.tsx
│   │   │   │   │   │   └── PublishButton.tsx
│   │   │   │   │   └── api.ts
│   │   │   │   ├── users/                 # FR38–FR41
│   │   │   │   ├── reference-data/        # FR43–FR48
│   │   │   │   └── notifications/         # FR49–FR53: In-app alert display
│   │   │   ├── components/
│   │   │   └── lib/
│   │   ├── vite.config.ts
│   │   └── package.json
│   │
│   ├── client-portal/                # Read-only SPA — Sobeys/Metro clients
│   │   ├── src/
│   │   │   ├── pages/
│   │   │   │   ├── LoginPage.tsx
│   │   │   │   ├── DashboardPage.tsx      # FR34–FR35: Multi-site status dashboard
│   │   │   │   └── SiteDetailPage.tsx     # FR36–FR37: Audit history + PDF download
│   │   │   ├── features/
│   │   │   │   ├── dashboard/
│   │   │   │   └── reports/
│   │   │   ├── components/
│   │   │   └── lib/
│   │   ├── vite.config.ts
│   │   └── package.json
│   │
│   ├── api/                          # Node.js 22 + Fastify 5 REST API
│   │   ├── src/
│   │   │   ├── app.ts                # Fastify instance + plugin registration
│   │   │   ├── server.ts             # HTTP server startup
│   │   │   ├── routes/
│   │   │   │   ├── auth.ts           # POST /auth/login, /auth/refresh, /auth/logout
│   │   │   │   ├── audits.ts
│   │   │   │   ├── sections.ts
│   │   │   │   ├── photos.ts
│   │   │   │   ├── calculations.ts
│   │   │   │   ├── reports.ts
│   │   │   │   ├── jobs.ts           # GET /jobs/:id — status polling
│   │   │   │   ├── locks.ts          # POST acquire, DELETE release, GET status
│   │   │   │   ├── users.ts
│   │   │   │   ├── stores.ts
│   │   │   │   ├── compressors.ts
│   │   │   │   └── weather.ts
│   │   │   ├── services/
│   │   │   │   ├── audit-state-machine.ts  # FR23–FR29: All state transitions
│   │   │   │   ├── calc-pipeline.ts        # FR16–FR22: Enqueue + LLM orchestration
│   │   │   │   ├── section-lock.ts         # FR54–FR57: Acquire/release/expire
│   │   │   │   ├── photo-lifecycle.ts      # FR11–FR15: Upload, tag, state-gate
│   │   │   │   ├── pdf-report.ts           # FR30–FR33: Enqueue Puppeteer job
│   │   │   │   ├── notification.ts         # FR49–FR53: Email + in-app alerts
│   │   │   │   ├── auth.ts
│   │   │   │   └── weather.ts              # FR47–FR48: Fetch CDD/HDD + fallback
│   │   │   ├── repositories/
│   │   │   │   ├── audit.repo.ts
│   │   │   │   ├── section.repo.ts
│   │   │   │   ├── calculation.repo.ts
│   │   │   │   ├── user.repo.ts
│   │   │   │   ├── compressor.repo.ts
│   │   │   │   ├── store.repo.ts
│   │   │   │   └── lock.repo.ts
│   │   │   ├── jobs/
│   │   │   │   ├── calculation.job.ts
│   │   │   │   ├── llm-review.job.ts
│   │   │   │   ├── pdf-generation.job.ts
│   │   │   │   └── email-notification.job.ts
│   │   │   ├── middleware/
│   │   │   │   ├── auth.ts
│   │   │   │   ├── rls.ts
│   │   │   │   ├── tenant.ts
│   │   │   │   └── error-handler.ts
│   │   │   └── lib/
│   │   │       ├── azure-blob.ts
│   │   │       ├── claude.ts
│   │   │       ├── resend.ts
│   │   │       ├── redis.ts
│   │   │       └── logger.ts
│   │   ├── tsconfig.json
│   │   └── package.json
│   │
│   └── calc-service/                 # Python 3.12 + FastAPI — internal microservice
│       ├── app/
│       │   ├── main.py
│       │   ├── routes/
│       │   │   ├── ecm.py            # POST /calculate/ecm
│       │   │   ├── baseline.py       # POST /calculate/baseline
│       │   │   └── refrigerant.py    # POST /calculate/refrigerant
│       │   ├── services/
│       │   │   ├── ecm_savings.py    # FR16: Floating suction + head pressure calcs
│       │   │   ├── energy_baseline.py # FR17: CDD/HDD regression
│       │   │   └── refrigerant.py    # FR18: Temp-to-pressure conversion
│       │   ├── models/
│       │   │   ├── ecm.py
│       │   │   ├── baseline.py
│       │   │   └── refrigerant.py
│       │   └── lib/
│       │       └── logger.py
│       ├── tests/
│       │   ├── test_ecm_savings.py
│       │   ├── test_energy_baseline.py
│       │   └── test_refrigerant.py
│       ├── requirements.txt
│       ├── Dockerfile
│       └── pyproject.toml
│
├── packages/
│   ├── ui/                           # Shared component library (shadcn/ui + Tailwind)
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── components/           # Button, Input, Modal, Badge, Table, ...
│   │   │   └── lib/
│   │   │       └── utils.ts          # cn() Tailwind merge utility
│   │   └── package.json
│   │
│   ├── types/                        # Shared TypeScript types + Zod schemas
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── audit.ts              # AuditStatus enum, Audit, AuditSection
│   │   │   ├── user.ts               # UserRole enum, User
│   │   │   ├── calculation.ts        # CalcResult, LlmFlag, OverrideRecord
│   │   │   ├── api.ts                # PaginatedResponse, ProblemDetail, JobStatus
│   │   │   └── forms/
│   │   │       ├── general.schema.ts
│   │   │       ├── refrigeration.schema.ts
│   │   │       ├── hvac.schema.ts
│   │   │       ├── lighting.schema.ts
│   │   │       └── building-envelope.schema.ts
│   │   └── package.json
│   │
│   ├── db/                           # Prisma schema + generated client
│   │   ├── prisma/
│   │   │   ├── schema.prisma
│   │   │   └── migrations/
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   └── middleware/
│   │   │       └── rls.ts
│   │   └── package.json
│   │
│   └── config/                       # Shared tooling configs
│       ├── eslint/index.js
│       ├── typescript/
│       │   ├── base.json
│       │   ├── app.json
│       │   └── server.json
│       └── tailwind/preset.ts
│
├── turbo.json
├── pnpm-workspace.yaml
├── package.json
├── .env.example
└── .gitignore
```

### Architectural Boundaries

**API Access Control**

| Boundary | Rule |
|---|---|
| Public API | All routes under `/api/v1/` — versioned from Day 1 |
| Auth boundary | Every route except `/auth/login` requires valid JWT via `middleware/auth.ts` |
| Tenant boundary | `middleware/tenant.ts` + `middleware/rls.ts` on every request before any DB access |
| Calc service | Internal only — no public URL; called from `api/jobs/calculation.job.ts` via VNet |
| Blob storage | Never direct-accessed from frontend — all access via server-issued state-gated SAS tokens |

**Service Layering Rules**

| Layer | Knows | Does Not Know |
|---|---|---|
| Routes | HTTP shapes, Zod validation | Business rules, DB structure |
| Services | Business rules, state machine, orchestration | HTTP protocol, Prisma models directly |
| Repositories | Prisma queries, column-to-camelCase mapping | Business rules, HTTP |

### FR Category → Directory Mapping

| FR Group | Primary Locations |
|---|---|
| FR1–FR10 (Audit Data Collection) | `audit-app/features/audit/`, `api/routes/audits.ts`, `api/routes/sections.ts`, `api/services/audit-state-machine.ts` |
| FR11–FR15 (Photo Capture) | `audit-app/features/photos/`, `api/routes/photos.ts`, `api/services/photo-lifecycle.ts`, `api/lib/azure-blob.ts` |
| FR16–FR22 (Calc + LLM) | `calc-service/app/`, `api/jobs/calculation.job.ts`, `api/jobs/llm-review.job.ts`, `api/services/calc-pipeline.ts` |
| FR23–FR29 (Audit Workflow) | `api/services/audit-state-machine.ts`, `admin-app/features/audit-queue/` |
| FR30–FR33 (Reports) | `api/jobs/pdf-generation.job.ts`, `api/services/pdf-report.ts`, `admin-app/features/reports/ReportTemplate.tsx` |
| FR34–FR37 (Client Portal) | `client-portal/` (entire app) |
| FR38–FR42 (Users & RBAC) | `api/routes/users.ts`, `api/middleware/auth.ts`, `api/middleware/rls.ts`, `packages/db/prisma/schema.prisma` |
| FR43–FR48 (Reference Data) | `api/routes/stores.ts`, `api/routes/compressors.ts`, `api/routes/weather.ts`, `admin-app/features/reference-data/` |
| FR49–FR53 (Notifications) | `api/jobs/email-notification.job.ts`, `api/services/notification.ts`, `api/lib/resend.ts` |
| FR54–FR57 (Multi-Auditor Locks) | `api/routes/locks.ts`, `api/services/section-lock.ts`, `api/repositories/lock.repo.ts`, `audit-app/features/section-locks/` |

## Architecture Validation Results

### Coherence Validation ✅

**Technology Compatibility:** All library versions confirmed mutually compatible. React 19 + TanStack Query v5 + Zustand + React Router v7 support concurrent features. BullMQ 5.74.1 requires Redis 6+ — Azure Cache for Redis C0/C1 runs Redis 6. Prisma 7.5.0 `@prisma/adapter-mssql` available. Puppeteer 24.35.0 ships bundled Chromium, compatible with Node.js 22.

**Pattern Consistency:** `snake_case` DB ↔ `camelCase` TS translation is isolated to the repository layer — one boundary, no ambiguity. RFC 7807 errors enforced globally via `middleware/error-handler.ts`. TanStack Query / Zustand split is unambiguous: API-sourced state → TanStack Query; ephemeral UI state → Zustand.

**Puppeteer Rendering Mechanism (resolved):** Puppeteer requires a URL, not a React component directly. Adopted **Option A — Internal API renderer**:

```
apps/api/src/
└── renderer/
    ├── report-bundle/     # Pre-compiled standalone HTML bundle (separate Vite build entry)
    │   └── index.html     # Self-contained ReportTemplate + chart libs
    └── report.route.ts    # GET /internal/report/:auditId — service-token auth, Puppeteer only
```

`admin-app/features/reports/ReportTemplate.tsx` has a separate `vite.config.report.ts` build entry that outputs to `apps/api/src/renderer/report-bundle/`. Puppeteer's `pdf-generation.job.ts` navigates to `http://localhost:{port}/internal/report/:auditId`, executes full JS (charts render), then calls `page.pdf()`. The API is self-contained — no dependency on admin-app being deployed for PDF generation to work.

### Requirements Coverage ✅

**All 57 FRs have architectural support.** All 18 NFRs have implementation mechanisms.

| NFR | Architectural Mechanism |
|---|---|
| NFR-P1 (≤2s transitions) | Azure Static Web Apps CDN + Turborepo tree-shaking + TanStack Query prefetch |
| NFR-P2 (non-blocking auto-save) | 800ms debounce + optimistic UI, no spinner |
| NFR-P3 (60s calc engine) | BullMQ async + 202 Accepted + polling `/api/v1/jobs/:id` |
| NFR-P4 (5min PDF) | BullMQ async + same polling pattern |
| NFR-S3 (Azure SQL RLS) | `rls.ts` middleware sets `SESSION_CONTEXT` on every Prisma connection |
| NFR-S4 (Immutable audit log) | `audit-log.repo.ts` insert-only repository; no update/delete methods; DB-layer no delete policy |
| NFR-R2 (Zero data loss) | Server-confirmed saves + `photoUploadStore` retry queue |
| NFR-R3 (Calc reproducibility) | Input snapshot stored via `calculation.repo.ts` before enqueuing job |
| NFR-SC3 (Tenant-scoped Day 1) | `tenant_id` on all entities; RLS middleware on every request |

### Gap Analysis Results

**3 gaps identified and resolved:**

**Gap 1 (Critical) — Puppeteer rendering mechanism:** Resolved above. `apps/api/src/renderer/` added to project structure. `audit-log.repo.ts` added to `apps/api/src/repositories/`.

**Gap 2 (Critical) — `audit_log` table / repository missing from structure:** `audit-log.repo.ts` added to `apps/api/src/repositories/`. Every state transition in `audit-state-machine.ts` and every LLM override in `calc-pipeline.ts` calls `auditLogRepo.appendLog()`. Insert-only — no update or delete methods on this repository.

**Gap 3 (Important) — Timing constants unspecified:** Defined in `packages/types/src/index.ts`:

```typescript
export const SECTION_LOCK_TTL_MS = 90_000        // Redis TTL
export const SECTION_LOCK_HEARTBEAT_MS = 30_000   // Heartbeat interval (useSectionLock.ts)
export const SECTION_LOCK_POLL_MS = 15_000        // Poll interval (audit-app polling)
export const PHOTO_MAX_SIZE_BYTES = 10 * 1024 * 1024  // 10MB
export const PHOTO_ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/heic']
```

### Architecture Completeness Checklist

**Requirements Analysis**
- [x] All 57 FRs analyzed and mapped to architectural components
- [x] All 18 NFRs have architectural mechanisms
- [x] 11 cross-cutting concerns identified and addressed
- [x] Multi-auditor concurrency added to MVP scope with Day 1 schema

**Architectural Decisions**
- [x] Technology stack fully specified with exact versions
- [x] Hybrid data model (relational + JSON columns) decided
- [x] JWT token strategy with role-specific TTLs documented
- [x] Azure SQL RLS via `SESSION_CONTEXT` middleware
- [x] Async job pipeline (BullMQ + Redis) for calc + PDF + email
- [x] Chart-to-PDF risk resolved (Puppeteer + internal API renderer)
- [x] Canada Central region (`canadacentral`) confirmed
- [x] 3-environment CI/CD with GitHub Actions defined

**Implementation Patterns**
- [x] 6 conflict zones identified and resolved
- [x] Naming conventions defined: DB (snake_case), API/TS (camelCase)
- [x] 7 mandatory agent rules documented
- [x] Anti-patterns explicitly listed

**Project Structure**
- [x] Complete directory tree for all 5 apps + 4 packages
- [x] All 10 FR groups mapped to specific files
- [x] Service/Repository/Route layer boundaries defined
- [x] 3 gaps from validation resolved and incorporated

### Architecture Readiness Assessment

**Overall Status: READY FOR IMPLEMENTATION**

**Confidence Level: High**

**Key Strengths:**
- Every FR traces to a specific file or service — no ambiguity for AI agents
- All async operations (calc, PDF, email) follow the same BullMQ + 202 + polling pattern
- Section locking schema-compatible with Post-MVP SSE upgrade — no migration required
- Internal Puppeteer renderer is self-contained within the API — no cross-service dependency for PDF generation
- LLM-first optimized: TypeScript throughout, consistent patterns prevent agent drift across multiple AI coding sessions

**Areas for Future Enhancement (Post-MVP):**
- SSE upgrade for section locks (no schema migration needed — designed for this)
- Azure AD SSO integration
- Playwright E2E test suite
- Azure Static Web Apps Standard tier (custom domains, auth providers)

### Implementation Handoff

**AI Agent Guidelines:**
1. Follow all architectural decisions exactly as documented — versions are pinned, do not upgrade without explicit instruction
2. Use implementation patterns from Step 5 consistently — naming, structure, format, and process patterns apply to all code
3. Respect the service/repository/route layer boundaries — business logic belongs in `services/`, never in route handlers
4. The `audit-state-machine.ts` service is the single authority for all audit state transitions — no state changes elsewhere
5. Every Prisma query must go through the RLS middleware — never use `$queryRaw` without `SESSION_CONTEXT` set

**First Implementation Step:**

```bash
npx create-turbo@latest cems --package-manager pnpm
```

Then follow Epic 1 (Foundation): monorepo scaffold → `packages/db` Prisma schema → `packages/types` → `packages/config` → API skeleton → auth routes.
