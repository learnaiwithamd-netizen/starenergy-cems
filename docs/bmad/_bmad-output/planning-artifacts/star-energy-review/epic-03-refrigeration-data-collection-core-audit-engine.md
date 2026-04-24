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

