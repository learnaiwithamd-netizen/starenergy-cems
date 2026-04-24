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

