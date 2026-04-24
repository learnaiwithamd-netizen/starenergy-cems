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

