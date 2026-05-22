# Star Energy CEMS — MVP Development Milestones

**Project:** Carbon / Energy Management System (CEMS)
**Client:** Star Energy
**Prepared by:** Abhishek Dwivedi
**Date:** May 2026

---

## Overview

CEMS is a three-surface platform: a **mobile-first Site Audit App** for field auditors, an **Admin Console** for Star Energy engineers, and a **Client Portal** for client organisations (Sobeys, Metro, et al.). The MVP covers the full supermarket energy audit workflow — from field data collection through calculation, report generation, and client delivery.

The build is structured across **10 milestones**. The first two are complete. The remaining eight deliver the end-to-end audit workflow, the calculation engine, and the client portal in sequence.

---

## Milestone Status Summary

| # | Milestone | Surfaces | Status |
|---|-----------|----------|--------|
| M1 | Platform Foundation & Access Control | All | ✅ Complete |
| M2 | Audit App Core — Store Selection, Auto-Save & Session | Audit App | ✅ Complete |
| M3 | Refrigeration Data Collection | Audit App | 🔨 Up Next |
| M4 | Photo Capture & Management | Audit App | 🔨 Upcoming |
| M5 | Remaining Audit Sections & Submission | Audit App | 🔨 Upcoming |
| M6 | Reference Data Management | Admin Console | 🔨 Upcoming |
| M7 | Admin Audit Queue & Workflow | Admin Console | 🔨 Upcoming |
| M8 | Calculation Engine & Anomaly Detection | Admin Console | 🔨 Upcoming |
| M9 | Report Generation & Publishing | Admin Console | 🔨 Upcoming |
| M10 | Client Portal | Client Portal | 🔨 Upcoming |

---

## Milestone Detail

---

### M1 — Platform Foundation & Access Control ✅ Complete

**What it delivers:** The technical backbone of the entire platform — hosting, database, deployment pipeline, shared component library, and secure login for all three user types.

**Capabilities delivered:**
- Secure email/password login for Auditors, Admins, and Clients — each role lands on the correct application automatically
- Admin can create and manage Auditor and Client accounts, assign stores to users, deactivate accounts
- Welcome email with password-set link sent on account creation
- Azure-hosted infrastructure (Canada Central) with staging and production environments
- Automated deployment pipeline (CI/CD) — every code change is tested and deployed without manual steps
- Shared component library and design system applied consistently across all three apps

**Why it matters:** No feature work can happen without this. Auth and infra are done once and carry the entire platform forward.

---

### M2 — Audit App Core: Store Selection, Auto-Save & Session ✅ Complete

**What it delivers:** An Auditor can open the app, see their assigned stores, select one, and begin an audit — with every keystroke saved automatically so no data is ever lost.

**Capabilities delivered:**
- Assigned store list loads on app open — tap a store to begin
- Store details (name, address, banner, region, operating hours, service providers) auto-fill from the reference database; address is enriched via Google Maps
- "Start Audit" creates a draft immediately — the audit is persisted before a single field is entered
- Auto-save fires 800ms after every field change — silent, no blocking, no spinner
- Auto-save indicator shows "✓ Saved" on success; "Save failed — retrying" with automatic retry on network error
- Persistent offline banner when connectivity is lost; resume fires automatically on reconnect
- Session resume from any device — reopening the app shows a "Resume audit at STORE-XXX" prompt; all previously saved data is pre-filled
- Section overview shows all 5 audit sections (General, Refrigeration, HVAC, Lighting, Building Envelope) with live completion status (Not Started / In Progress / Complete) and a progress bar

**Why it matters:** Auditors can start working without friction and never lose data mid-audit regardless of connectivity.

---

### M3 — Refrigeration Data Collection 🔨 Up Next

**What it delivers:** The most complex section of the audit — the full refrigeration walkthrough — guided screen by screen with validation, duplication shortcuts, and support for multi-auditor teams.

**Capabilities delivered:**
- Guided navigation: Machine Room → Racks → Compressors → Condensers → Walk-in Coolers → Display Cases → Controller Systems
- Breadcrumb always shows the auditor's exact position in the refrigeration hierarchy
- Required fields enforced — can't advance with missing data; red border + shake animation on failed attempt
- Help tooltips (`?`) on every field explaining what to enter and showing sample photos
- "Duplicate rack" shortcut — copy all non-unique data from one rack to a new one (saves 10–15 min per repeated rack type)
- On-site new compressor entry when the compressor is not in the regression database
- Multi-auditor section locking — two auditors can work the same audit simultaneously without overwriting each other

**Why it matters:** Refrigeration is the highest-value data in the audit and the most time-consuming to collect. This milestone enables the full refrigeration ECM calculation.

---

### M4 — Photo Capture & Management 🔨 Upcoming

**What it delivers:** In-app camera capture with automatic photo tagging to the correct equipment, plus a reliable upload queue that handles poor connectivity.

**Capabilities delivered:**
- Native camera integration — photos taken from within the app, no switching to the device camera roll
- Automatic tagging — each photo is tagged to the equipment and location where it was taken (e.g., Rack 2 / Compressor #3)
- Help overlay showing exactly what photo is required and a sample image for guidance
- Additional photos and comments can be added to any equipment item
- Upload queue with automatic retry — photos taken offline are queued and uploaded automatically when connectivity returns
- Upload status visible to the auditor — "Uploading 3 of 5 photos" with per-photo progress

**Why it matters:** Photo evidence is a required part of every audit submission. Auto-tagging eliminates the manual re-association step that today takes 30–60 minutes in the office.

---

### M5 — Remaining Audit Sections & Submission 🔨 Upcoming

**What it delivers:** The remaining four audit sections — General, HVAC, Lighting, and Building Envelope — plus the final review and submission flow that marks an audit complete.

**Capabilities delivered:**
- **General section:** Store info, service company details, contact persons, audit date and conditions
- **HVAC section:** Air handling units, exhaust fans, split systems, heating equipment
- **Lighting section:** Interior and exterior lighting inventory, controls, hours of operation
- **Building Envelope section:** Walls, roof, doors, glazing — insulation and condition notes
- Review screen showing a summary of all five sections with any outstanding items flagged before submission
- One-tap "Submit Audit" — system validates all required fields are complete before allowing submission
- Submission confirmation screen with reference number; auditor receives email confirmation
- Audit status transitions to SUBMITTED in the admin queue

**Why it matters:** Completes the full auditor workflow from store selection to final submission. After M5, Priya can complete an entire audit on her phone in under 4 hours.

---

### M6 — Reference Data Management 🔨 Upcoming

**What it delivers:** Admin tools to manage the underlying reference data that powers the audit app and calculation engine — stores, compressor specifications, and weather data.

**Capabilities delivered:**
- **Store management:** Admin can add, edit, and deactivate store records; assign stores to auditors and clients
- **Compressor regression database:** Admin can add/update compressor models with EER/capacity regression coefficients; field auditors see these in real time during the audit
- **Weather data:** Admin can pull weather data from Environment Canada (climate.weather.gc.ca) or degreedays.net by postal code; manual override available for edge cases

**Why it matters:** The calculation engine (M8) depends entirely on accurate reference data. Store and compressor data must be correct before calculations can run.

---

### M7 — Admin Audit Queue & Workflow 🔨 Upcoming

**What it delivers:** A centralised queue where the admin team tracks all active audits, monitors SLA timers, and drives audits through the review workflow.

**Capabilities delivered:**
- Filterable audit queue — filter by status, client, auditor, date range
- Seven audit states with clear visual badges: Draft → Submitted → In Review → Calc Complete → Approved → Published → Delivered
- Live SLA countdown timer for each audit — green (>3h), amber (1–3h), red (<1h) with 4-hour SLA target from submission
- Audit detail slide-out panel — full audit data and photos without leaving the queue page
- State transitions: Admins move audits forward with a single action; all transitions are logged with timestamp and actor
- Photo lock after submission — field data cannot be changed once an audit is in IN_REVIEW or later state
- Audit log — complete history of every status change, calculation run, and approval action

**Why it matters:** Raj's queue is the operational control centre for Star Energy's office team. Without this, the 4-hour report turnaround target is not achievable.

---

### M8 — Calculation Engine & Anomaly Detection 🔨 Upcoming

**What it delivers:** The engineering calculation engine that transforms raw audit data into projected energy savings figures — with Claude AI reviewing results for anomalies before human sign-off.

**Capabilities delivered:**
- **Refrigeration ECM calculations:** Floating suction pressure control and floating head pressure control savings — compressor-by-compressor, rack-by-rack, using the regression database for EER/capacity curves
- **Energy baseline:** Weather-normalised annual energy baseline using CDD/HDD regression against utility meter data (kWh); separates weather effects from operational changes
- **LLM anomaly detection:** Claude reviews each calculation run and flags any result that looks unusual (e.g., "Suction pressure on Rack 2 appears unusually high — verify field reading"); admin sees the flag with a suggested action
- **Admin override with justification:** Admin can dismiss any flag and enter a justification note; overridden flags are retained in the audit log for traceability
- **Calculation inputs/outputs view:** Admin can see every variable that fed into a calculation and re-run after correcting a value
- Calculation state transitions automatically to CALC_COMPLETE when the engine finishes

**Why it matters:** This is the core intellectual property of CEMS — the automated calculation that currently takes days of manual spreadsheet work reduced to minutes with an AI quality check. Without M8, CEMS is a data collection tool; with M8, it is a complete energy savings platform.

---

### M9 — Report Generation & Publishing 🔨 Upcoming

**What it delivers:** Automated generation of client-ready PDF reports from approved audit data, with a one-click publish action that makes reports available in the client portal.

**Capabilities delivered:**
- **Automated PDF generation:** Report is generated from structured audit data — no manual formatting; includes baseline energy, projected savings by measure, equipment inventory, tagged photos, and methodology notes
- **Admin review before publish:** Admin reviews the generated PDF before it reaches the client; can request corrections and re-generate
- **One-click approve & publish:** Admin approves and publishes in a single action; report becomes immediately available in the client portal
- **Report versioning:** If a correction is required after publishing, a new version is generated and the previous one is preserved for audit trail
- **Client email notification:** Client receives an email notification when a new report is published to their portal
- **Re-generation after data correction:** Admin can correct a field value and trigger a re-run of calculations + report regeneration without starting from scratch

**Why it matters:** The end product for Star Energy's clients is the report. M9 closes the loop from audit completion (M5) to client delivery — targeting ≤4 hours from Priya's "Submit" to the Sobeys portal showing the new report.

---

### M10 — Client Portal 🔨 Upcoming

**What it delivers:** A read-only portal where Star Energy's clients (Sobeys, Metro, et al.) track the status of all their sites and access approved reports and energy savings summaries.

**Capabilities delivered:**
- **Multi-site dashboard:** All sites under a client account in one view — audit status, last audit date, number of active recommendations
- **Per-site audit history:** Timeline of all audits for each store with current status badge
- **Report viewing and download:** Approved PDFs viewable in-browser and downloadable; only reports that have been admin-approved are visible
- **ECM savings summary:** Energy savings projections per site in a clean summary view — baseline consumption, projected savings (kWh and $), key contributing measures
- **Access control:** Clients see only their own sites; no visibility into other clients' data (enforced by row-level security at the database)
- **Contact and notification preferences:** Client can update contact details and choose email notification preferences for new reports

**Why it matters:** Clients today receive reports by email attachment with no visibility into what's happening between audit visits. The portal gives them a professional, always-current view of Star Energy's work — differentiating CEMS from every competitor still using email.

---

## MVP Completion Definition

The MVP is complete when **all 10 milestones are done** and the following outcomes are verified:

| Outcome | Target |
|---------|--------|
| Full audit completable on mobile in one visit | ≤ 4 hours |
| Admin report turnaround after submission | ≤ 4 hours |
| Required field completion rate on submission | 100% |
| Admin manual re-entry of field data | 0 fields |
| Concurrent active audit projects supported | 20 sites |

---

## Post-MVP Roadmap (Not in Scope for This Engagement)

The following have been intentionally deferred and will be discussed separately:

- **Native iOS & Android apps** — MVP runs on mobile browsers; native app adds offline sync and camera hardware API access
- **Offline mode** — Current MVP requires connectivity; offline-first with background sync is a post-MVP capability
- **Additional sectors** — MVP covers Supermarket only; Retail, Cold Storage, Hospitality, Warehouse follow
- **Project Management & Incentive Tracking** — Project lifecycle, rebate tracking, contractor coordination modules
- **Interval meter data (Green Button)** — Utility data file ingestion for automated baseline without manual meter entry
- **OEM API integration** — Live compressor performance data from Copeland/Bitzer APIs (replaces regression DB lookup)

---

*Questions or changes to this milestone plan — contact Abhishek Dwivedi.*
