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

