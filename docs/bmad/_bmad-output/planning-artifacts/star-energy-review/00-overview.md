# Star Energy CEMS — Epics & Stories for Review

Welcome. This workspace contains the full epic-and-story breakdown for the **Star Energy Carbon/Energy Management System (CEMS)** build, derived from the approved PRD, architecture, and UX design specification.

Please review each epic page and leave inline comments on anything you'd like to challenge, clarify, refine, or prioritize differently.

---

## How to review

1. Open each Epic page in the left sidebar (Epic 0 through Epic 10).
2. Read the epic description to understand the goal.
3. Within each epic, read the user stories and their acceptance criteria (written in **Given / When / Then** format).
4. Leave a comment directly on any line or heading you want to discuss — use `@mention` to tag the right person.
5. When finished, mark the epic page as **✅ Reviewed** (or leave a top-page comment `REVIEWED – no changes`).

---

## What you're reviewing

| # | Epic | What it delivers |
|---|------|------------------|
| 0 | Platform Foundation & Developer Infrastructure | Monorepo, Azure setup, shared UI library, CI/CD — enables all feature work |
| 1 | Authentication & User Management | Login for all three user types; admin manages accounts |
| 2 | Audit App — Store Selection & Session Foundation | Auditor picks a store, starts a draft, auto-saves, resumes on any device |
| 3 | Refrigeration Data Collection (Core Audit Engine) | Full refrigeration walkthrough: Machine Room → Racks → Compressors → Condensers → Walk-ins → Display Cases → Controller → Systems |
| 4 | Photo Capture & Management | On-device camera capture, auto-tagging, upload queue with retry |
| 5 | Remaining Audit Sections & Submission | General, HVAC, Lighting, Building Envelope sections + final submission |
| 6 | Reference Data & System Configuration | Admin manages store reference DB, compressor regression DB, weather fallback |
| 7 | Admin Audit Queue & State Machine | Admin queue with filters, SLA timers, state transitions |
| 8 | Calculation Engine & Anomaly Detection | ECM refrigeration + energy baseline calcs; Claude flags anomalies; admin overrides with justification |
| 9 | Report Generation & Publishing | PDF report generation, approval, publish to client portal |
| 10 | Client Portal | Client dashboard, per-site reports, PDF download |

---

## Key review questions to keep in mind

- **Scope:** Does each epic deliver something meaningful on its own? Anything missing?
- **Priority:** Is the ordering right (Epic 0 → 10)? Would you pull anything forward or push anything out of MVP?
- **Acceptance criteria:** Are any ACs unclear, untestable, or missing a case you care about?
- **Non-functional requirements:** Are the performance, security, and accessibility targets realistic for your operation?
- **Integrations:** External systems referenced — weather APIs, Google Maps, Resend email, Claude API — anything you'd prefer we swap?

---

## Context documents (linked separately)

- **PRD** — the product requirements this breakdown derives from
- **Architecture** — technical design (Azure Canada Central, Turborepo, 3 apps + API + calc microservice)
- **UX Design Specification** — design tokens, component library, accessibility targets

---

## Out of scope for this review

- Implementation detail within each story (that's the dev team's concern)
- Exact Azure SKU choices or library versions (architecture-level, already approved)
- Offline mode (decided: connectivity-required MVP; offline deferred)

---

## Timeline

Please complete review by **[Abhishek to confirm date with Star Energy]**. Questions mid-review → reach out to Abhishek directly.
