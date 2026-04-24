## Epic 8: Calculation Engine & Anomaly Detection

**Goal:** Execute refrigeration ECM savings calculations, build energy baselines via CDD/HDD regression, run LLM anomaly flagging, surface results to auditors and admins, and provide a re-run pathway when inputs change.

**FRs Covered:** FR38, FR39, FR40, FR41, FR42, FR43, FR44, FR45, FR46

---

### Story 8.1: Calculation Pipeline — ECM Refrigeration Savings

**As an** Auditor who has submitted an audit for calculation,
**I want** the system to automatically compute refrigeration ECM savings for each equipment item,
**So that** I receive accurate energy and cost savings estimates without performing manual calculations.

**Acceptance Criteria:**

**Given** an audit transitions to CALC_PENDING (FR38),
**When** the BullMQ `cems:calculation:normal` job is picked up by the calc-service,
**Then** for each refrigeration ECM line item the service computes kWh savings using the approved formula (runtime hours × load reduction × efficiency factor), persists results to `EquipmentCalculation`, and marks the job complete

**Given** the calc-service completes all line items,
**When** results are persisted,
**Then** the audit state machine advances to CALC_COMPLETE and the assigned Auditor receives an in-app notification (FR39)

**Given** a calculation job fails (exception or timeout),
**When** BullMQ exhausts retries (3 attempts, exponential back-off),
**Then** the audit state is set to CALC_ERROR, the error is logged to Azure Monitor, and the Admin console shows a banner with job ID and failure reason (FR38)

**Given** an Auditor views a CALC_COMPLETE audit,
**When** they expand any equipment row,
**Then** per-item kWh savings, cost savings (at site utility rate), and simple payback period are displayed (FR39)

---

### Story 8.2: Calculation Pipeline — Energy Baseline (CDD/HDD Regression)

**As an** Auditor reviewing an audit's calculation results,
**I want** the system to generate a weather-normalised energy baseline using CDD/HDD regression,
**So that** reported savings are adjusted for climate variation and comparable year-over-year.

**Acceptance Criteria:**

**Given** utility interval data and weather data are available for the audit site (FR40),
**When** the baseline job runs inside the calc-service,
**Then** an OLS regression of kWh against CDD and HDD is performed, R² and RMSE are stored in `EnergyBaseline`, and the baseline model coefficients are persisted

**Given** the regression R² is below 0.70,
**When** results are stored,
**Then** a warning flag `LOW_R2` is attached to the baseline record and surfaced in the Admin console review panel (FR40)

**Given** a valid baseline exists,
**When** Auditor views the Baseline tab on the audit detail screen,
**Then** a scatter plot of actual vs. predicted consumption is rendered along with the regression equation and goodness-of-fit metrics (FR41)

**Given** weather data fetch fails (external API timeout),
**When** the baseline job cannot proceed,
**Then** the job is parked in `WEATHER_FETCH_FAILED` status, an alert is raised, and the audit proceeds to CALC_COMPLETE with a "Baseline pending" notice (FR40)

---

### Story 8.3: LLM Anomaly Flagging

**As an** Admin reviewing calculation results,
**I want** the system to run an LLM pass over audit data to surface anomalies and inconsistencies,
**So that** potential data-quality issues are caught before the report is approved.

**Acceptance Criteria:**

**Given** an audit reaches CALC_COMPLETE (FR42),
**When** the `cems:llm-review:normal` BullMQ job runs,
**Then** the LLM receives a structured JSON payload (equipment list, measurements, baseline, ECM line items) and returns an array of `AnomalyFlag` objects: `{field, severity, reason, suggestedValue}`

**Given** the LLM response is received,
**When** flags are persisted to `AuditAnomalyFlag`,
**Then** the Admin console review panel shows each flag with severity badge (HIGH / MEDIUM / LOW), the affected field highlighted, and the LLM's reasoning (FR42)

**Given** the LLM job exceeds 30 s or returns a non-200,
**When** the job fails after 2 retries,
**Then** the audit advances to IN_REVIEW without LLM flags and a "LLM review unavailable" notice is shown to the Admin (FR42)

**Given** an Admin has resolved a flag (accepted or dismissed),
**When** they save the resolution,
**Then** the flag record is updated with `resolvedBy`, `resolvedAt`, and `resolution` enum; the flag is visually marked resolved in the UI (FR42)

---

### Story 8.4: Admin Flag Override & Justification

**As an** Admin reviewing LLM-flagged anomalies,
**I want** to override a flagged value with a corrected value and record my justification,
**So that** the audit record reflects the correct data with a full audit trail.

**Acceptance Criteria:**

**Given** an Admin opens a HIGH or MEDIUM anomaly flag (FR43),
**When** they enter an override value and justification (minimum 20 characters),
**Then** the original value is retained in `AnomalyFlag.originalValue`, the override value is written to the source field, and the override is logged in `AuditLog` with `performedBy`, `timestamp`, and `justification`

**Given** an Admin tries to save an override without justification,
**When** they click Save,
**Then** inline validation blocks submission and displays: "Justification required — minimum 20 characters" (FR43)

**Given** an Admin dismisses a flag without overriding,
**When** they select "Dismiss — data is correct" and confirm,
**Then** the flag is marked `DISMISSED` with their user ID and timestamp; no field value changes (FR43)

**Given** an audit is subsequently exported or reported,
**When** the report is generated,
**Then** all overrides and dismissals appear in an "Admin Adjustments" appendix section of the PDF (FR43)

---

### Story 8.5: Calculation Inputs/Outputs View & Re-run

**As an** Admin or Auditor,
**I want** to view the exact inputs consumed by the calculation engine and trigger a re-run when inputs are corrected,
**So that** I can verify calculation integrity and refresh results after data corrections.

**Acceptance Criteria:**

**Given** a CALC_COMPLETE or CALC_ERROR audit (FR44),
**When** an Admin opens the Calculation Detail panel,
**Then** a read-only table shows every input variable passed to the calc-service (equipment specs, utility rates, weather coefficients) alongside the resulting output values and job metadata (job ID, duration, calc-service version)

**Given** an Auditor corrects a measurement that was used as a calc input (FR45),
**When** the correction is saved,
**Then** the system sets audit state to CALC_STALE and displays a "Recalculation required" banner with a Re-run button

**Given** an Admin clicks Re-run (FR45),
**When** the new `cems:calculation:normal` job is enqueued,
**Then** the previous `EquipmentCalculation` and `EnergyBaseline` records are soft-deleted (archived), the new job runs with the corrected inputs, and results replace the stale values upon completion

**Given** a re-run is in progress,
**When** the Auditor views the audit,
**Then** a progress indicator and job status (QUEUED / RUNNING / COMPLETE) are shown via polling (5 s interval) until the job resolves (FR46)

---

