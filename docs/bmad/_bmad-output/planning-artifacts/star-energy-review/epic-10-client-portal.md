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
