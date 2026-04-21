---
stepsCompleted: ['step-01-init', 'step-02-discovery', 'step-02b-vision', 'step-02c-executive-summary', 'step-03-success', 'step-04-journeys', 'step-05-domain', 'step-06-innovation', 'step-07-project-type', 'step-08-scoping', 'step-09-functional', 'step-10-nonfunctional', 'step-11-polish']
releaseMode: phased
inputDocuments:
  - 'docs/Audit App related csv files/CEMS_Hierarchy010726_PP_2.xlsx - RBAC.csv'
  - 'docs/Audit App related csv files/CEMS_Hierarchy010726_PP_2.xlsx - Overview.csv'
  - 'docs/Audit App related csv files/CEMS_Hierarchy010726_PP_2.xlsx - Screens.csv'
  - 'docs/Audit App related csv files/CEMS_Hierarchy010726_PP_2.xlsx - EA_General.csv'
  - 'docs/Audit App related csv files/CEMS_Hierarchy010726_PP_2.xlsx - Listed table.csv'
  - 'docs/Audit App related csv files/CEMS_Hierarchy010726_PP_2.xlsx - Supermarket_EA.csv'
  - 'docs/Audit App related csv files/CEMS_Hierarchy010726_PP_2.xlsx - HVAC.csv'
  - 'docs/Audit App related csv files/CEMS_Hierarchy010726_PP_2.xlsx - Ref_Rack.csv'
  - 'docs/Audit App related csv files/CEMS_Hierarchy010726_PP_2.xlsx - Ref_MR.csv'
  - 'docs/Audit App related csv files/CEMS_Hierarchy010726_PP_2.xlsx - Ref_Compressor.csv'
  - 'docs/Audit App related csv files/CEMS_Hierarchy010726_PP_2.xlsx - Ref_Condenser.csv'
  - 'docs/Audit App related csv files/CEMS_Hierarchy010726_PP_2.xlsx - Ref_Controller.csv'
  - 'docs/Audit App related csv files/CEMS_Hierarchy010726_PP_2.xlsx - Ref_Conv Unit.csv'
  - 'docs/Audit App related csv files/CEMS_Hierarchy010726_PP_2.xlsx - Ref Display.csv'
  - 'docs/Audit App related csv files/CEMS_Hierarchy010726_PP_2.xlsx - Ref_Systems.csv'
  - 'docs/Audit App related csv files/CEMS_Hierarchy010726_PP_2.xlsx - Ref_WI.csv'
  - 'docs/Audit App related csv files/CEMS_Hierarchy010726_PP_2.xlsx - db.csv'
  - 'docs/Audit App related csv files/CEMS_Hierarchy010726_PP_2.xlsx - dropdown.csv'
  - 'docs/CEMS_PRD_1.0 (1).docx'
  - 'docs/Scope of Work_CEMS.docx'
workflowType: 'prd'
briefCount: 0
researchCount: 0
brainstormingCount: 0
projectDocsCount: 20
classification:
  projectType: mobile-first-web-app
  domain: energy-building-automation
  complexity: high
  projectContext: brownfield
  mvpScope:
    sectors: [supermarket]
    auditTypes: [energy-audit]
    offlineMode: false
    nativeApp: false
  postMvp:
    - native iOS and Android apps
    - offline mode
    - additional sectors (Retail, Cold Storage, Hospitality, Warehouse)
    - Project Management module
    - Project Tracking
    - Incentive Tracking
---

# Product Requirements Document - Star Energy CEMS

**Author:** Abhishek
**Date:** 2026-04-18

## Executive Summary

CEMS (Carbon/Energy Management System) is a two-interface energy analytics platform built for Star Energy. The **Site Audit App** (mobile-first web application) guides field auditors through structured on-site data collection across refrigeration, HVAC, and lighting systems at supermarket locations. The **Admin Console** (desktop web application) gives Star Energy's team access to incoming audit data, an engineering calculation engine, weather-normalized energy baselines, and client-ready reporting. MVP targets supermarket sector only.

**Primary users:**
- **Auditors** — field technicians conducting structured on-site energy audits
- **Admins (Star Energy / SE India)** — office staff processing audit data, running calculations, managing reports and client communication
- **Clients** (Sobeys, Metro, et al.) — reviewing audit results, energy savings projections, and project status across multiple sites

**Problem being solved:** Commercial energy audits today rely on inconsistent manual processes — paper forms, disconnected photos, and fragmented handoffs — resulting in missed data on-site, hours of manual re-entry in the office, and energy savings calculations done in siloed spreadsheets that are slow, error-prone, and hard to present to clients. Star Energy cannot efficiently scale to multiple simultaneous sites or provide clients with a professional, transparent view of their work.

### What Makes This Special

CEMS closes the entire loop from field data collection to verified energy savings — in one platform. The guided mobile workflow enforces a complete, consistent audit at the point of collection. That structured data then feeds directly into an **engineering calculation engine** that computes compressor baseline energy consumption, projects savings from refrigeration optimizations (floating suction/head pressure control), and performs weather-normalized energy baseline analysis (CDD/HDD regression) to calculate actual post-retrofit savings. The result: a mathematically rigorous, client-presentable proof of energy savings — produced automatically from audit data, not assembled by hand. For clients, this is transparent, multi-site visibility into Star Energy's work. For Star Energy, it is the operational infrastructure to scale.

**Key integrations (MVP):** Weather APIs (climate.weather.gc.ca, degreedays.net) for baseline normalization; Google Maps API for store address lookup; Star Energy compressor regression DB for EER/capacity calculations; Claude API for LLM-assisted calculation QA. **Post-MVP:** OEM APIs (Copeland, Bitzer) for real-time compressor performance; Green Button utility meter ingestion.

## Project Classification

| Attribute | Value |
|-----------|-------|
| **Project Type** | Mobile-first web app (Site Audit) + Web portal (Admin Console + Calculation Engine) |
| **Domain** | Energy / Building Automation |
| **Complexity** | High — engineering calculation engine, OEM API dependencies, weather normalization, multi-role RBAC, deep equipment taxonomy |
| **Context** | Brownfield — detailed field specs and calculation methodologies exist; MVP scoped to Supermarket sector |
| **Post-MVP** | Native iOS/Android, offline mode, additional sectors, Project Management module, interval meter data (Green Button), natural gas baseline |

## Success Criteria

### User Success

**Auditors (Site Audit App)**
- Full supermarket energy audit completed on-site in **≤4 hours** (down from 16 hours across 2 days — 75% reduction)
- Zero incomplete submissions — required fields enforced at each screen before progression
- All photos tagged to the correct equipment/location at point of capture, no manual re-association
- Auditor can navigate the full workflow on a mobile browser without training beyond onboarding

**Admins (Admin Console)**
- Audit data arrives structured and complete — no manual data re-entry from field submissions
- Calculation engine (refrigeration ECM, energy baseline) runs with LLM-assisted review (Claude preferred) and human approval checkpoints — not fully automated black-box, but not fully manual either
- Client-ready report generated within **4 hours** of audit completion (down from 3 days)
- Admin can approve and publish final reports to client portal in one action

**Clients (Client Portal)**
- All active site audit statuses visible in a single dashboard
- Energy savings projections presented with transparent, credible methodology
- Final approved reports always available on-demand, per site, per audit — accessible only after Admin approval and upload

### Business Success

| Metric | Target |
|--------|--------|
| Sites managed at MVP launch | 20 |
| Sites managed at 12 months | 100 |
| Primary growth levers | New client acquisition + faster throughput per existing client |
| Report turnaround | ≤4 hours post-audit (vs. 3 days today) |
| Audit time reduction | 75% (16 hrs → 4 hrs per site) |

### Technical Success

- 3 MVP RBAC roles (Auditor, Admin, Client) functional with correct permission boundaries at launch; permissions-table architecture ready for post-MVP role additions (Service Provider, OEM/Technician, Super Admin) as data-only changes
- LLM (Claude API) integrated into admin calculation review workflow — flags anomalies, suggests corrections, requires human sign-off
- Mobile browser app performs reliably on standard iOS/Android browsers with no native app required for MVP
- External integrations operational: weather API (climate.weather.gc.ca / degreedays.net), compressor lookup (regression DB)
- System supports 20 concurrent active audit projects without degradation

### Measurable Outcomes

- Audit completion time: ≤4 hours per site
- Report generation time: ≤4 hours post-audit completion
- Data completeness rate: 100% required fields on submission
- Admin manual re-entry: 0 fields
- Sites under management: 20 at launch → 100 at 12 months

## Product Scope

### MVP — Minimum Viable Product

- **Site Audit App** (mobile browser): Supermarket sector, Energy Audit type, all 5 system sections (General, Refrigeration, HVAC, Lighting, Building Envelope), photo capture with tagging
- **Admin Console** (web/desktop): Audit data review, LLM-assisted calculation engine (refrigeration ECM + energy baseline), human approval checkpoints, report generation and publishing
- **Client Portal** (web): Multi-site dashboard, approved report access (read-only, post-admin approval)
- **RBAC**: 3 roles at MVP (Auditor, Admin, Client) on permissions-table architecture; 3 additional roles (Service Provider, OEM/Technician, Super Admin) added post-MVP as data-only changes
- **Integrations**: Weather APIs, Google Maps, compressor regression DB, Claude API, Azure Blob, transactional email

### Growth Features (Post-MVP)

- Native iOS and Android apps
- Offline mode with sync
- Additional sectors: Retail, Cold Storage, Hospitality, Warehouse
- Project Management module
- Interval meter data ingestion (Green Button / utility file upload)
- Natural gas baseline calculations
- Automated weather station selection by GPS

### Vision (Future)

- Full OEM API integration (Copeland, Bitzer) for real-time compressor performance lookup
- Predictive analytics and anomaly detection across site portfolio
- National chain multi-site benchmarking dashboards
- Carbon/emissions reporting alongside energy savings
- Incentive and rebate tracking module

## User Journeys

### Journey 1: Priya — The Field Auditor (Primary User, Success Path)

Priya is a refrigeration technician working for Star Energy. She's been doing site audits for 3 years, currently armed with a clipboard, a camera, and a 12-page paper form she fills out over two days at each store. She dreads the follow-up call from admin asking why the rack model number is missing.

**Opening Scene:** Priya arrives at a Sobeys in Mississauga at 7am. She logs into CEMS on her phone, selects the store from a pre-loaded list, and the General section auto-fills the store name, address, and her service company details. She's already 10 minutes ahead.

**Rising Action:** She works through each system section — the app guides her to the Machine Room first, then each rack, then compressors. Required fields won't let her skip. She snaps a photo of the nameplate; the app tags it as Rack 1 / Compressor #3 automatically. A `?` help icon shows her exactly what photo is needed and a sample.

**Climax:** At 11am — 4 hours in — she hits "Submit Audit." The app confirms all required fields are complete. She's done. Previously this would've been Day 1 of 2.

**Resolution:** Priya gets a confirmation. Admin gets the data instantly. No phone calls, no missing fields. Priya drives to her next site.

*Reveals requirements: guided sequential workflow, field validation, auto-fill from DB, photo tagging, help tooltips, submission confirmation.*

---

### Journey 2: Priya — Edge Case (Interrupted Audit)

Priya is mid-audit on the HVAC section when the store manager pulls her aside for 2 hours. She closes her browser.

**Critical moment:** When she reopens CEMS, the app resumes exactly where she left off. Her partially completed audit is saved as a draft. She continues from the AHU section without losing any data.

*Reveals requirements: auto-save / draft state, session persistence, audit resume functionality.*

---

### Journey 3: Raj — The Admin (Admin Console)

Raj is a Star Energy engineer in the Toronto office. He manages 8 active audits this week across 3 clients.

**Opening Scene:** Priya's audit lands in Raj's queue at 11:05am. He opens it on his laptop — all 200+ data points are structured, photos are tagged, nothing is missing.

**Rising Action:** Raj clicks "Run Calculations." The system runs the ECM refrigeration savings model. Claude flags an anomaly: "Suction pressure on Rack 2 appears unusually high — verify field reading." Raj checks the photo, confirms it's correct, overrides the flag, and approves.

**Climax:** Raj clicks "Generate Report." A formatted PDF is produced in minutes — baseline energy, projected savings, equipment inventory, photos included. He reviews it, clicks "Approve & Publish to Client."

**Resolution:** At 2:30pm — 3.5 hours after Priya submitted — the Sobeys client portal shows the new audit report. Raj has already moved to the next site in his queue.

*Reveals requirements: admin audit queue, LLM anomaly flagging with override, calculation engine, PDF report generation, one-click publish to client portal.*

---

### Journey 4: Sandra — The Client (Sobeys Energy Manager)

Sandra manages energy for 40 Sobeys locations in Ontario. She used to get a Word document by email, weeks after the site visit, with no way to compare sites.

**Opening Scene:** Sandra gets an email notification: "Audit report for Store #1042 — Brampton is ready." She logs into the CEMS client portal.

**Rising Action:** She sees her dashboard: 8 of her locations have completed audits this year. She opens the Brampton report — equipment inventory, photos, energy savings projections, transparent methodology. She downloads the PDF for her CFO.

**Resolution:** Sandra can compare energy savings potential across sites, prioritize retrofits, and share reports with internal stakeholders. She calls her Star Energy rep: "Can we add 5 more locations next quarter?"

*Reveals requirements: client portal with multi-site dashboard, read-only approved report access, PDF download, email notifications, audit history per site.*

---

### Journey Requirements Summary

| Journey | Key Capabilities Revealed |
|---------|--------------------------|
| Auditor — Success Path | Guided sequential workflow, auto-fill from DB, field validation, photo tagging, help tooltips, submission confirmation |
| Auditor — Edge Case | Draft auto-save, session persistence, audit resume |
| Admin | Audit queue, LLM anomaly detection + human override, calculation engine, PDF report generation, client portal publish |
| Client | Multi-site dashboard, read-only report portal, PDF download, email notifications, per-site audit history |

## Platform Architecture & Technical Requirements

### Project-Type Overview

CEMS is a single-tenant SaaS B2B platform at MVP, serving Star Energy as the sole operator. The architecture must be multi-tenancy-ready via tenant-scoped data models so that onboarding additional auditing companies in later phases requires no schema migration. The platform spans two interfaces: a mobile-browser audit app for field use and a desktop web admin/client portal.

### Tenant Model

| Attribute | Decision |
|-----------|----------|
| Tenancy | Single-tenant (Star Energy) at MVP |
| Architecture | Tenant-ID scoped data models from Day 1 |
| Multi-tenant | Post-MVP (later phases) |
| Billing module | Post-MVP |

### RBAC — MVP (3 Roles)

MVP launches with 3 roles built on a **permissions-table architecture** (roles table + permissions table + role-permissions mapping). This means post-MVP role additions (Service Provider, OEM/Technician, Super Admin) are data changes — no code changes required.

| Role | Site Audit App | Admin Console | Client Portal | User Management |
|------|---------------|--------------|---------------|-----------------|
| **Auditor** | ✅ Full access | ❌ | ❌ | ❌ |
| **Admin (Star Energy)** | ✅ View | ✅ Full access | ✅ View | ✅ Below own level |
| **Client (Sobeys/Metro)** | ❌ | ❌ | ✅ Own sites only | ❌ |

Row-level data visibility enforced at **database level** (Azure SQL Row Level Security) — a Sobeys client user can only retrieve rows where `client_id = Sobeys`. This is enforced at the data layer, not application layer, given the sensitivity of commercial energy data for competing retailers.

### Audit State Machine

```
[DRAFT] ──── Auditor submits ────► [IN_REVIEW]
                                        │
                              Claude runs calculations
                                        │
                          ┌─── anomaly? ───┐
                          │               │
                    [FLAGGED]         [CALC_COMPLETE]
                          │               │
                  Clock paused      Admin reviews
                  Admin notified        │
                          │         approve?
                  Admin resolves        │
                  (override +     [APPROVED]
                   justification)      │
                          │      Client notified (email)
                          └──────────► │
                                  [DELIVERED]
                                        │
                                   [CLOSED]
```

| State | Who Can Act | What Triggers Next | Notes |
|-------|------------|-------------------|-------|
| **DRAFT** | Auditor | Auditor submits | Auto-save every field change to server |
| **IN_REVIEW** | System (Claude) | Claude finishes analysis | Auditor edit locked; photos locked in Azure Blob |
| **FLAGGED** | Admin | Admin resolves flag | SLA clock paused; admin notified. No path back to auditor — Admin corrects or overrides with justification |
| **CALC_COMPLETE** | Admin | Admin approves | Report assembled with dynamic charts + text |
| **APPROVED** | System | Email sent + PDF available | Immutable; no further edits |
| **DELIVERED** | Client (read-only) | Download / auto-close after X days | Audit trail complete |
| **CLOSED** | Admin (archive) | Manual or auto-close | Immutable record |

### Platform Requirements

| Interface | Platform | MVP |
|-----------|---------|-----|
| Site Audit App | Mobile browser (iOS Safari, Android Chrome) | ✅ |
| Admin Console | Desktop web | ✅ |
| Client Portal | Desktop web + mobile browser | ✅ (read-only PDF download) |
| Native iOS/Android | Native apps | Post-MVP |

### Device Capabilities (Browser-Based, MVP)

| Capability | Web API | Notes |
|-----------|---------|-------|
| Camera / photo capture | MediaDevices API | Primary capture for all equipment photos |
| GPS / location | Geolocation API | Site location, weather station selection |
| File upload | File API | Document upload |
| Torch/flash | MediaTrackConstraints `torch` | Android Chrome supported; iOS Safari limited — in-app guidance provided |

### Connectivity & Graceful Degradation

Offline mode is not in MVP scope (mobile browser limitation; Star Energy owner confirms 4G+ coverage at all audit sites). Browser app requires active connectivity. Full offline-first is Post-MVP, delivered via native iOS/Android application. However, the following UX resilience requirements are mandatory for MVP:

- Auto-save to server on every field change (not just on submit)
- Visible connectivity status indicator in the audit UI
- Calm "reconnecting..." state on connection loss — no blank screens or silent failures
- Zero data loss on reconnect — failed submits do not require re-entry
- Photo upload state visible (queued / uploading / failed / confirmed)

### Notification Requirements (MVP — Email Only)

| Trigger | Recipient | Type |
|---------|----------|------|
| Audit submitted | Admin | Email |
| Audit received confirmation | Auditor | Email |
| Anomaly flagged by Claude | Admin | In-app alert (SLA clock paused) |
| Report approved & published | Client | Email |
| Compressor model not found in DB | Admin | In-app alert |

### Integration List

| Integration | Purpose | Phase |
|-------------|---------|-------|
| climate.weather.gc.ca | Daily mean temp for energy baseline | MVP |
| degreedays.net | CDD/HDD lookup (fallback: Admin manual entry) | MVP |
| Google Maps API | Store address auto-population | MVP |
| Star Energy Compressor Regression DB | Compressor capacity/EER calculations | MVP (internal, admin-configurable) |
| Claude API (Anthropic) | LLM-assisted calculation QA and anomaly flagging | MVP |
| Azure Blob Storage | Photo storage (locked at IN_REVIEW, immutable post-approval) | MVP |
| Transactional email service | Email notifications | MVP |
| Copeland / Bitzer OEM APIs | Real-time compressor performance data | Post-MVP |
| Green Button / utility file upload | Interval meter data ingestion | Post-MVP |
| US (NOAA) / Indian weather sources | Expanded geographic weather data | Post-MVP |

### Implementation Considerations

- **Session persistence:** Audit drafts auto-saved to server on every field change; auditors can resume from any device without data loss
- **Photo storage:** Azure Blob with structured metadata (site → system → equipment → photo type); locked at IN_REVIEW transition; immutable post-approval
- **Report generation:** Server-side PDF generation including dynamic charts rendered from audit + calculated data. Chart-to-PDF pipeline (e.g., headless browser or server-side chart library) is a **medium-complexity technical risk** — architecture team to confirm approach before implementation
- **Compressor not in DB:** Auditor gets on-site data entry to add new compressor specs, which syncs to Star Energy's central compressor regression DB
- **degreedays.net fallback:** If API unavailable, Admin can manually enter degree-day data to unblock report generation
- **Data residency:** Azure (Canadian region) — to confirm exact region with infrastructure team
- **API versioning:** v1 prefix from Day 1 on all endpoints to support future mobile app and multi-tenant expansion without breaking changes
- **Form/calculation versioning:** Audit submissions are stamped with the form version and compressor DB version at time of submission to ensure historical audits remain reproducible

## Domain-Specific Requirements

### Compliance & Regulatory

- **Data Privacy (PIPEDA):** Not in scope for MVP. To be addressed in post-MVP phase as client and site data volume grows.
- **Energy Savings Report Standards (e.g., IPMVP):** No standard mandated by Star Energy at this time. To be confirmed with Star Energy — flagged as a post-MVP consideration once utility programs are engaged at scale.
- **Utility Rebate Report Format:** Star Energy's clients claim utility rebates based on audit reports. Star Energy will provide the required report format/template. MVP report generation must conform to this template. *(Action item: Star Energy to supply the mandated report format before report generation is built.)*

### Technical Constraints

- **Weather Data:** Canadian weather stations only for MVP via climate.weather.gc.ca. US and Indian sources are post-MVP.
- **Temperature/Pressure Conversions:** The calculation engine must support refrigerant-specific temp-to-pressure conversions for all refrigerants in the equipment database (R507, R22, R134a, R404a, R407A, R407c, R448a, R449a, R502, R513a, R12 — per the Listed table CSV).
- **Compressor Performance Database:** Energy calculations use a Star Energy-maintained regression equation database (not OEM APIs). This database will evolve during the MVP phase. The system must support database updates without code changes (admin-configurable). OEM API integration (Copeland, Bitzer) is post-MVP.
- **Calculation Fallback:** If a compressor model is not in the regression database, the system must surface a clear admin alert — calculations cannot silently fail or produce incorrect results.

See [Integration List](#integration-list) in Platform Architecture & Technical Requirements for the complete integration inventory including post-MVP integrations.

See [Risk Mitigation Strategy](#risk-mitigation-strategy) in Project Scoping & Phased Development for the consolidated risk register.

## Innovation & Novel Patterns

### Detected Innovation Areas

**1. AI-Assisted Engineering Calculation QA**
Claude (LLM) is embedded as a review layer in the calculation-to-report pipeline — flagging anomalies in compressor performance data, energy baseline outputs, and projected savings before human approval. This is a human-in-the-loop AI pattern applied to a domain (building energy auditing) where LLMs have not previously been used in a formal engineering QA capacity. The admin retains full override authority; Claude surfaces issues, not decisions.

**2. End-to-End Audit Automation in a Single Platform**
CEMS connects: guided mobile data collection → structured data storage → automated engineering calculations (refrigeration ECM, energy baseline) → LLM-reviewed outputs → client-ready report. No known commercial energy audit platform integrates this full chain. Existing tools handle isolated segments — field collection apps, standalone calculation tools, or report generators — requiring manual handoffs between each. CEMS eliminates those handoffs entirely.

**3. Proprietary Compressor Performance Database as a Competitive Moat**
Rather than depending on OEM APIs (which are unreliable, costly, or unavailable), Star Energy is building a proprietary regression-based compressor performance database derived from real-world field data. This database evolves during and after the MVP phase. As more audits are conducted, the database becomes more accurate and comprehensive — creating a data asset that competitors cannot easily replicate and that increases CEMS's calculation accuracy over time.

### Market Context

The energy audit software market is fragmented — dominated by general-purpose field data tools (e.g., ProntoForms, GoAudits) and standalone energy calculation spreadsheets. No known platform combines domain-specific guided auditing for HVAC/refrigeration with an integrated engineering calculation engine and AI-assisted review. Star Energy's deep domain expertise (calculation methodologies, refrigerant knowledge, utility rebate processes) is what makes this platform viable — it is not a generic tool but a domain-encoded system.

### Validation Approach

| Innovation | Validation Method |
|-----------|------------------|
| AI-assisted QA | Measure false positive/negative rate of Claude anomaly flags vs. admin overrides across first 20 MVP audits |
| End-to-end automation | Track report turnaround time (target: ≤4 hours); measure admin manual intervention rate |
| Compressor DB accuracy | Compare DB-calculated vs. actual measured power draw across first 50 compressors audited |

### Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| Claude flags too many false positives → admin alert fatigue | Tune prompts with initial audit data; add confidence threshold before flagging |
| Compressor DB coverage too thin at launch | Surface clear "model not found" alerts; allow admin manual entry as fallback |
| End-to-end automation creates over-reliance, errors go unnoticed | Human approval checkpoint mandatory before any report is published to client |

## Project Scoping & Phased Development

### MVP Strategy & Philosophy

**MVP Approach:** Platform MVP — the full audit-to-report chain must be operational at launch. A partial delivery (e.g., audit collection only, no calculation engine) would not reduce Star Energy's 3-day report turnaround. MVP closes the entire loop: collect → calculate → LLM-review → approve → report → deliver.

**Resource Requirements:** Full-stack web team with mobile-responsive frontend capability; one engineer with energy domain familiarity for calculation engine; DevOps for Azure infrastructure. Estimated team: 4–6 engineers + 1 PM + 1 QA.

### MVP Feature Set (Phase 1)

**Core User Journeys Supported:**
- Auditor: guided on-site supermarket energy audit workflow, end-to-end
- Admin: calculation review, LLM-assisted QA, report generation and client publish
- Client: multi-site dashboard, approved report access and PDF download

**Must-Have Capabilities:**

*Site Audit App (Mobile Browser)*
- Supermarket sector, Energy Audit type only
- All 5 system sections: General, Refrigeration (full hierarchy: Machine Room, Racks, Compressors, Condensers, Walk-Ins, Display Cases, Controller, Systems), HVAC, Lighting, Building Envelope
- Guided sequential screen workflow with per-screen field validation (required fields enforced before progression)
- Auto-fill store/service provider/manager data from pre-loaded database
- Photo capture with structured tagging (site → system → equipment → photo type)
- Context-sensitive `?` help tooltips with sample photos at every screen
- Auto-save to server on every field change; draft resume from any device
- Connectivity status indicator + graceful reconnect UX (no data loss on disconnect)
- On-site new compressor entry (model not in DB → flags admin for sync)
- Multi-auditor concurrent access: section-level polling-based locking (15–30s refresh); "In Progress by [name]" indicator; lock expiry on inactivity; joint submission when all sections complete
- Audit submit confirmation and email receipt to auditor

*Admin Console (Desktop Web)*
- Incoming audit queue: structured, complete data with no manual re-entry
- LLM-assisted calculation engine: Claude runs ECM refrigeration savings (floating suction/head pressure control) + weather-normalized energy baseline (CDD/HDD regression)
- Anomaly flagging with human override + justification audit trail; SLA clock pauses at FLAGGED state
- Full audit state machine enforced: DRAFT → IN_REVIEW → FLAGGED/CALC_COMPLETE → APPROVED → DELIVERED → CLOSED
- Server-side PDF report generation with dynamic charts (energy baseline, savings projections, equipment inventory, photos)
- One-click Approve & Publish to Client Portal
- Manual degreedays.net fallback entry (unblocks report generation if API unavailable)
- Admin-configurable compressor regression DB (no code change required for DB updates)
- RBAC user management: create and manage Auditor and Client accounts

*Client Portal (Desktop + Mobile Browser)*
- Multi-site dashboard: all active and completed audits per client account
- Read-only approved report view with PDF download
- Per-site, per-audit history
- Email notification on report ready

*Infrastructure & Cross-Cutting*
- 3-role RBAC (Auditor, Admin, Client) on permissions-table architecture
- Azure SQL Row-Level Security — client data isolation enforced at DB layer
- Single-tenant (Star Energy) with tenant-ID scoped data models (multi-tenancy-ready)
- Azure Blob photo storage (locked at IN_REVIEW, immutable post-approval)
- API v1 prefix on all endpoints from Day 1
- Form + compressor DB version stamping on every audit submission

*Integrations (MVP)*
- climate.weather.gc.ca — daily mean temperatures
- degreedays.net — CDD/HDD lookup (manual Admin fallback)
- Google Maps API — store address auto-population
- Star Energy Compressor Regression DB — internal, admin-configurable
- Claude API (Anthropic) — LLM-assisted calculation QA and anomaly flagging
- Azure Blob Storage — photo storage
- Transactional email service — all notification triggers

### Post-MVP Features (Phase 2)

**Phase 2 (Growth — Mobile Native + Scale):**
- Native iOS and Android apps
- Offline mode with background sync
- Additional sectors: Retail, Cold Storage, Hospitality, Warehouse
- Project Management module (post-audit project tracking)
- Interval meter data ingestion (Green Button / utility file upload)
- Natural gas baseline calculations
- Automated GPS-based weather station selection
- Real-time section lock updates via Server-Sent Events (upgrade from MVP polling-based locking)
- Remaining 3 RBAC roles: Service Provider, OEM/Internal Technician, Super Admin (data-only additions — zero code changes required due to permissions-table architecture)
- Project Tracking module
- Incentive Tracking module
- Multi-tenancy (onboard additional auditing companies)
- Billing module

**Phase 3 (Vision — Intelligence & Scale):**
- Full OEM API integration (Copeland, Bitzer) for real-time compressor performance
- Predictive analytics and portfolio-level anomaly detection
- National chain multi-site benchmarking dashboards
- Carbon / emissions reporting alongside energy savings
- Fully automated incentive and rebate tracking
- US (NOAA) and Indian weather data sources

### Risk Mitigation Strategy

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Chart-to-PDF pipeline complexity (dynamic charts in server-side PDF) | Medium | Medium | Architecture team to confirm rendering approach (headless browser vs. server-side chart library) before implementation sprint — this is the primary technical risk |
| Compressor regression DB coverage too thin at launch | Medium | High | On-site new compressor entry flow + admin alert; manual override; DB pre-population sprint before launch |
| Utility rebate report format not confirmed before report build | Medium | High | Block report generation feature dev until Star Energy supplies mandated template *(Action item: Star Energy to provide)* |
| Refrigeration hierarchy depth — largest dev surface in the field spec | High (effort) | Medium | Prioritize refrigeration screens in sprint 1; other 4 sections are significantly shallower |
| LLM prompt calibration requires real audit data | Medium | Medium | Launch with conservative flag thresholds; iterate after first 10 MVP audits |
| degreedays.net API unavailability | Low | Medium | Admin manual entry fallback in scope |
| Weather station data unavailable for a site location | Low | Medium | Manual weather station selection in the audit UI |
| Report standard compliance (e.g., IPMVP) required retroactively | Low | Medium | Flagged as post-MVP; modular report template design allows format swap without full rebuild |
| Azure Canadian data residency region confirmation | Low | Low | Infrastructure action item already logged |

## Functional Requirements

### Audit Data Collection

- **FR1:** Auditor can select an assigned store from a pre-loaded list of locations authorized for their login
- **FR2:** Auditor can view auto-populated store details (name, address, banner, region, operating hours, service providers, managers) based on store selection
- **FR3:** Auditor can navigate the energy audit as a guided, sequential workflow of screens organized by system section
- **FR4:** Auditor can complete all five system sections: General, Refrigeration (Machine Room, Racks, Compressors, Condensers, Walk-Ins, Display Cases, Controllers, Systems), HVAC, Lighting, and Building Envelope
- **FR5:** Auditor can view context-sensitive help instructions and a sample reference image at every data entry screen
- **FR6:** Auditor cannot progress past a screen until all required fields for that screen are completed
- **FR7:** Auditor can duplicate a previously entered rack or equipment entry to pre-fill a similar entry
- **FR8:** Auditor can save an in-progress audit as a draft at any point and resume from any device without data loss
- **FR9:** Auditor can submit a completed audit once all required fields across all sections are filled
- **FR10:** System stamps each submitted audit with the active form version and compressor database version at time of submission

### Photo Capture & Management

- **FR11:** Auditor can capture photos directly within the audit workflow using the device camera
- **FR12:** Auditor can view the required framing instructions and a sample reference photo before capturing each required photo
- **FR13:** System automatically associates each photo to its equipment, section, and screen context at point of capture
- **FR14:** Auditor can add additional photos beyond the required minimum at any screen
- **FR15:** Auditor can add a text comment alongside any photo

### Calculation Engine & LLM Review

- **FR16:** System can automatically run ECM refrigeration savings calculations (floating suction pressure control and floating head pressure control) from submitted audit data
- **FR17:** System can automatically run weather-normalized energy baseline analysis (CDD/HDD regression) from submitted audit data
- **FR18:** System can apply temperature-to-pressure conversions for all refrigerant types supported in the compressor database
- **FR19:** System (via LLM integration) can analyze calculation inputs and outputs and flag anomalies for admin review before approval
- **FR20:** Admin can view each flagged anomaly with the LLM's reasoning and choose to override it with a mandatory justification note
- **FR21:** Admin can view all calculation inputs, intermediate values, and outputs for any calculation run
- **FR22:** Admin can re-run calculations after resolving or overriding flagged anomalies

### Audit Workflow & State Management

- **FR23:** System enforces the audit state machine: DRAFT → IN_REVIEW → FLAGGED or CALC_COMPLETE → APPROVED → DELIVERED → CLOSED
- **FR24:** Admin can view all audits in a queue, filterable by state, site, client, and date
- **FR25:** Admin can approve an audit in CALC_COMPLETE state, advancing it to APPROVED
- **FR26:** Admin can resolve a FLAGGED audit by applying overrides and justifications without returning the audit to the auditor
- **FR27:** System pauses the report SLA clock when an audit enters FLAGGED state and restores it when the flag is resolved
- **FR28:** Admin can archive a DELIVERED audit to CLOSED state
- **FR29:** Photo assets are locked from modification when an audit transitions to IN_REVIEW, and become immutable upon APPROVED

### Report Generation & Distribution

- **FR30:** Admin can generate a formatted PDF report from an approved audit, including equipment inventory, tagged photos, energy baseline analysis, and projected savings
- **FR31:** Admin can publish an approved report to the client portal in a single action
- **FR32:** Published (APPROVED) reports are immutable — no edits are permitted after approval
- **FR33:** Admin can regenerate a report if calculation changes are made prior to the APPROVED state

### Client Dashboard & Report Access

- **FR34:** Client can view a dashboard of all their audit projects across all assigned sites, showing current status for each
- **FR35:** Client can view per-site audit history and access all approved reports for that site
- **FR36:** Client can download an approved audit report as a PDF
- **FR37:** Client can only view and access data and reports for sites assigned to their account

### User & Access Management

- **FR38:** Users can authenticate with their credentials and receive access only to the interface and data their role permits
- **FR39:** Admin can create, edit, and deactivate Auditor accounts
- **FR40:** Admin can create, edit, and deactivate Client accounts and assign them to specific site locations
- **FR41:** System enforces role-based interface access: Auditors access only the Site Audit App; Clients access only the Client Portal; Admins access all interfaces
- **FR42:** System enforces row-level data isolation so each client account can only retrieve records for their own assigned locations

### Reference Data & System Configuration

- **FR43:** Admin can pre-load and manage store reference data (store number, name, banner, address, region, operating hours, service providers, managers) accessible to auditors during audit collection
- **FR44:** Admin can manage the compressor regression database — add, update, and retire compressor models — without requiring code changes
- **FR45:** Auditor can enter a new compressor model on-site when the model is not found in the database, triggering an admin notification to sync the new entry to the central database
- **FR46:** System can retrieve current outdoor temperature and historical degree-day data for a site's location from external weather data sources
- **FR47:** Admin can manually enter degree-day data when the external weather data API is unavailable
- **FR48:** System can auto-populate store address details via an address lookup service using the store number

### Multi-Auditor Concurrent Access

- **FR54:** Multiple auditors can be assigned to the same site audit and work on different sections simultaneously
- **FR55:** System prevents two auditors from editing the same audit section at the same time — section displays "In Progress by [auditor name]" when locked by another auditor
- **FR56:** Section locks expire automatically after a configurable inactivity timeout (heartbeat-based) so an abandoned session does not permanently block other auditors
- **FR57:** Audit submission is permitted only when all required sections are complete, regardless of which auditor completed each section

### Notifications & Alerts

- **FR49:** System notifies the admin by email when an auditor submits a completed audit
- **FR50:** System sends an email confirmation to the auditor when their audit submission is received
- **FR51:** System notifies the admin with an in-app alert and pauses the SLA clock when the LLM flags an anomaly during calculation review
- **FR52:** System notifies the client by email when an approved report is published to their portal
- **FR53:** System alerts the admin when an auditor submits a compressor model not found in the regression database

## Non-Functional Requirements

### Performance

- **NFR-P1:** Site Audit App screen transitions complete in ≤2 seconds on a standard 4G mobile connection
- **NFR-P2:** Auto-save executes in the background without blocking or delaying auditor UI interaction
- **NFR-P3:** Calculation engine (ECM refrigeration savings + energy baseline) completes within 60 seconds of audit submission
- **NFR-P4:** PDF report generation completes within 5 minutes of admin triggering report creation
- **NFR-P5:** Admin Console audit queue loads in ≤3 seconds for up to 100 active audit records
- **NFR-P6:** External API calls (weather, Google Maps) time out after 5 seconds and surface a defined fallback or error state — auditor workflow is never blocked by external API latency

### Security

- **NFR-S1:** All data in transit between client and server is encrypted via TLS 1.2 or higher
- **NFR-S2:** All data at rest — audit data, photos, calculation results, report PDFs — is encrypted in Azure storage
- **NFR-S3:** Row-level data isolation is enforced at the database layer (Azure SQL RLS) — client data separation cannot be bypassed at the application layer
- **NFR-S4:** All admin override actions (LLM flag overrides, calculation corrections, justification notes) are recorded in an immutable audit log with timestamp and user identity
- **NFR-S5:** API keys and service credentials are never embedded in client-side code; all secrets are managed via environment-level secret management
- **NFR-S6:** User sessions expire after a configurable period of inactivity (default to be confirmed with Star Energy — field audit sessions may span several hours)
- **NFR-S7:** LLM (Claude API) calls transmit only the audit data fields necessary for anomaly analysis — no raw personally identifiable information is included in prompts

### Scalability

- **NFR-SC1:** System supports 20 concurrent active audit projects at launch without performance degradation
- **NFR-SC2:** System architecture supports scaling to 100 concurrent active audit projects at 12 months through infrastructure-only changes — no code changes required
- **NFR-SC3:** All data models are tenant-ID scoped from Day 1, enabling multi-tenant onboarding in post-MVP without schema migration

### Reliability

- **NFR-R1:** System availability target: 99.5% uptime during business hours (Monday–Friday, 6am–8pm local time)
- **NFR-R2:** Zero audit data loss — if a network drop occurs mid-audit, all previously saved field data is fully recoverable from the server on reconnect
- **NFR-R3:** Calculation results are stored with a full snapshot of their inputs — any historical audit can be recalculated from stored data and produce the same result (reproducibility)
- **NFR-R4:** Photo uploads that fail due to connectivity are retried automatically; auditor is notified of final upload status (success or permanent failure)
- **NFR-R5:** If the Claude API is unavailable, the audit enters a manual-review holding state and admin is notified — the audit pipeline does not silently stall

### Accessibility

- **NFR-A1:** All interactive elements in the Site Audit App meet a minimum touch target size of 44×44 points (iOS/Android Human Interface Guidelines) for usability in field conditions including gloved use
- **NFR-A2:** Audit app UI does not rely solely on color to communicate status — all status indicators include text labels or icons for legibility in high-ambient-light field environments

### Integration

- **NFR-I1:** Each external API integration (weather, Google Maps, degreedays.net) has a defined fallback behavior — external API failures do not block the auditor workflow or the admin calculation workflow
- **NFR-I2:** The Claude API integration must return a response or timeout within 30 seconds
- **NFR-I3:** Transactional email notifications achieve ≥98% delivery rate (provider SLA target)
- **NFR-I4:** All external API integrations use versioned endpoints; the system handles upstream API version changes without silent data corruption or calculation errors
