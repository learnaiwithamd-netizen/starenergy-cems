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

