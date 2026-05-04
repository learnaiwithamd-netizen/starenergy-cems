---
parentDoc: _bmad-output/planning-artifacts/epics.md
generatedFrom:
  - docs/Audit App related csv files/
  - _bmad-output/planning-artifacts/prd.md
  - _bmad-output/planning-artifacts/architecture.md
generatedOn: 2026-05-02
modulesCovered:
  - HVAC (granular screens)
  - Lighting (granular screens)
  - Building Envelope (granular screens)
  - Refrigeration sub-equipment (Condenser, Walk-In, Display Case, Conv Unit, Systems, Controller deep)
  - Required-Photo discipline (cross-cutting)
  - Multi-Sector & Multi-Audit-Type framework
  - Reference-Data admin expansion (non-compressor refrigeration + dropdowns + listed tables + data points)
  - Contractor Depository
  - Auth additions (OTP, Super Admin, Service Provider, OEM roles)
  - Generalised Copy-from-Previous
runs:
  - 2026-05-02
---

# Audit App MVP — Epics & Stories Addendum

## Source Coverage

| CSV | Module(s) it informs | Coverage status (after this addendum) |
|---|---|---|
| `Overview.csv` | Program sections | Calc/Dashboard/Reporting (Epics 8–10) covered. Depository now covered (Epic 17). Sectorwise apps covered via Epic 15. Project Mgmt deferred — Post-MVP per RBAC.csv. |
| `Screens.csv` | Full screen tree per Sector × Audit Type | Supermarket × Energy Audit covered (Epics 3, 5). Multi-sector / multi-audit-type framework covered (Epic 15). OTP screen covered (Story 1.5). |
| `EA_General.csv` | General section fields (1.01–1.10) | Covered (Story 5.1). |
| `HVAC.csv` | HVAC module | **Empty** in source — actual HVAC field spec lives in `Supermarket_EA.csv`. Now covered at screen level (Epic 11). |
| `Supermarket_EA.csv` | HVAC, Lighting, Building Envelope, extended refrigeration | Now covered at screen level (Epics 11, 12, 13). |
| `RBAC.csv` | 6-role matrix | Auditor/Admin/Client covered (Epic 1). Super Admin / Service Provider / OEM now covered (Stories 1.6, 1.7, plus Epic 17). |
| `dropdown.csv` | Master dropdown values | Admin management now covered (Story 16.2). |
| `Listed table.csv` | Screen → listed-table mappings | Admin management now covered (Story 16.3). |
| `db.csv` | Sample store reference data | Covered (Story 6.1). |
| `Ref_Compressor.csv` | Compressor 2.3 family | Covered (Story 3.3). |
| `Ref_Condenser.csv` | Condenser 2.5 family | Now covered at screen level (Story 13.1). |
| `Ref_Controller.csv` | Controller 2.8 family | Now covered at screen level (Story 13.6). |
| `Ref_Conv Unit.csv` | Conventional Unit 2.4 family | Now covered (Story 13.4). |
| `Ref_MR.csv` | Machine Room 2.1 family | Covered (Story 3.1). |
| `Ref_Rack.csv` | Rack 2.2 family | Covered (Story 3.2). |
| `Ref_Systems.csv` | Systems 2.9 family | Now covered at screen level (Story 13.5). |
| `Ref_WI.csv` | Walk-In 2.6 family | Now covered at screen level (Story 13.2). |
| `Ref Display.csv` | Display Case 2.7 family | Now covered at screen level (Story 13.3). |
| `Data point.csv` | Master data-point identity table | Now covered (Story 16.4). |

**CSV issues flagged for the user:**

1. `HVAC.csv` is header-only (3 lines). All HVAC fields live in `Supermarket_EA.csv` rows 41–~280. Recommend regenerating `HVAC.csv` from the master sheet so HVAC has its own dedicated tab.
2. `Supermarket_EA.csv` contains many `#VALUE!` cells — these are Excel formula errors, not real values. Recommend a clean export pass.
3. `RBAC.csv` row 5 (Service Provider/SE Competitor) grants `Yes` for `Create/Revoke account of users below hierarchy` and `Allow access to sectors and audit types` — broader than typical service-provider permissions. Treat as authoritative for now; flag to product owner for confirmation.
4. `Listed table.csv` row 28 has trailing entries that don't map to listed columns — assume incomplete spec; admin UI should accept any number of listed-table mappings.

---

## Proposed New Functional Requirements

These are referenced by stories below but not yet in `prd.md`. Recommend folding into PRD on next edit pass.

| FR-NEW | Description |
|---|---|
| FR-NEW-1 | System supports multiple audit types per audit project (Energy Audit, HVAC Survey, Case Survey, Refrigeration Retrofit Survey, Lighting Survey) with audit-type-specific screen subsets and calculation routing. |
| FR-NEW-2 | System supports multiple sectors (Supermarket, Cold Storage, Warehouse, Hospitality, Retail) with sector-specific screen subsets and reference-data scoping. |
| FR-NEW-3 | System enforces an OTP second factor at login for all roles, delivered via email or SMS, with configurable TTL. |
| FR-NEW-4 | System supports a Super Admin role with cross-tenant administration capability above the per-tenant Admin role. |
| FR-NEW-5 | System supports a Service Provider role limited to depository upload and read access for their assigned sites — no audit data entry, no calculations, no reports. |
| FR-NEW-6 | System supports an OEM/Internal Technician role limited to data-collection app access with no reporting, calculation, or admin capability. |
| FR-NEW-7 | Admin can manage all refrigeration equipment reference DBs (Condenser, Controller, Conv Unit, Walk-In, Display Case, Rack, Systems) without code changes — analogous to FR44. |
| FR-NEW-8 | Admin can manage master dropdown values, listed-table sources, and data-point identity references without code changes; values cannot be deleted while in use by any audit. |
| FR-NEW-9 | Service Provider can upload pictures, quotes, and supporting documents to a depository area scoped to their assigned sites; uploaded items are linkable to audits and reports. |
| FR-NEW-10 | Auditor can duplicate any sub-equipment entry — Walk-In, Display Case, Conventional Unit, System — generalised from FR7. |
| FR-NEW-11 | Each photo-required screen displays a sample reference image and framing instructions before the auditor captures the photo (extension of FR12 to all photo screens). |
| FR-NEW-12 | System enforces audit-type × sector configuration — Admin can configure which screens appear for each (sector, audit-type) pair without code changes. |

---

## Epic List (Addendum)

### Epic 11: HVAC Section — Detailed Screens
Auditor completes the HVAC section as a sequence of equipment-grouped screens (RTU/AHU, Exhaust, Make-Up Air, Ventilation, HVAC Controls) with full field-level guidance and required-photo enforcement, replacing the lumped Story 5.2.
**FRs covered:** FR3, FR4 (HVAC), FR5, FR6, FR7, FR-NEW-10, FR-NEW-11
**CSV sources:** `Supermarket_EA.csv` HVAC rows, `Listed table.csv`, `Screens.csv` col 30

### Epic 12: Lighting & Building Envelope — Detailed Screens
Auditor completes Lighting (Interior, Exterior, Controls) and Building Envelope (Roof/Walls/Doors/Windows/Vestibule) at screen level, replacing the lumped Story 5.3.
**FRs covered:** FR3, FR4 (Lighting, BldgEnv), FR5, FR6, FR-NEW-11
**CSV sources:** `Supermarket_EA.csv` Lighting + Building Envelope rows, `Screens.csv` cols 31–32, `Listed table.csv`

### Epic 13: Refrigeration Sub-Equipment — Deep Screens
Auditor completes screen-level data entry for Condenser (2.5), Walk-In (2.6), Display Case (2.7), Conventional Unit (2.4), Refrigeration Systems (2.9), and Controller deep sub-tree (2.8), replacing the lumped Stories 3.4 and 3.5.
**FRs covered:** FR3, FR4 (refrigeration), FR5, FR6, FR7, FR-NEW-10, FR-NEW-11
**CSV sources:** `Ref_Condenser.csv`, `Ref_WI.csv`, `Ref Display.csv`, `Ref_Conv Unit.csv`, `Ref_Systems.csv`, `Ref_Controller.csv`

### Epic 14: Required-Photo Discipline & Sample Image Flow
Cross-cutting epic establishing the universal photo-capture pattern: required photo enforcement, sample reference images, framing instructions, photo-context auto-binding, captions, and additional-photo support across all sections.
**FRs covered:** FR11, FR12, FR13, FR14, FR15, FR-NEW-11
**CSV sources:** All `Ref_*.csv` "Picture..." sub-screens, `Supermarket_EA.csv` Pic IDs

### Epic 15: Multi-Sector & Multi-Audit-Type Framework
System routes auditor through sector-specific (Supermarket / Cold Storage / Warehouse / Hospitality / Retail) and audit-type-specific (Energy Audit / HVAC Survey / Case Survey / Refrigeration Retrofit Survey / Lighting Survey) screen subsets; admin configures the matrix without code changes.
**FRs covered:** FR3, FR-NEW-1, FR-NEW-2, FR-NEW-12
**CSV sources:** `Screens.csv` (Sector + Audit Type cols), `Supermarket_EA.csv` Sector + Audit Type cols, `Overview.csv` row 13

### Epic 16: Reference-Data Admin Expansion
Admin manages all refrigeration equipment reference DBs (Condenser, Controller, Conv Unit, Walk-In, Display Case, Rack, Systems), the master dropdown library, listed-table sources, and the data-point identity reference — all without code changes; with version stamping and audit logging.
**FRs covered:** FR43, FR44 (extended), FR-NEW-7, FR-NEW-8, NFR-S4
**CSV sources:** `Ref_*.csv` schemas, `dropdown.csv`, `Listed table.csv`, `Data point.csv`

### Epic 17: Contractor Depository
Service Provider uploads pictures, quotes, and supporting documents to a depository area scoped to assigned sites; admin reviews, categorises, and links items to specific audits or report sections.
**FRs covered:** FR-NEW-5, FR-NEW-9, NFR-S2, NFR-S3
**CSV sources:** `Overview.csv` row 5, `RBAC.csv` Service Provider row

---

## Additions to Existing Epics

### Additions to Epic 1: Authentication & User Management

- New Story 1.5: OTP Second Factor at Login
- New Story 1.6: Super Admin Tier — Cross-Tenant Administration
- New Story 1.7: Service Provider & OEM Roles — Capability Enforcement

### Additions to Epic 3: Refrigeration Data Collection

- New Story 3.7: Generalised Copy-from-Previous for All Sub-Equipment

---

## Epic 11: HVAC Section — Detailed Screens

Auditor completes the HVAC section as a sequence of equipment-grouped screens with field-level guidance and required-photo enforcement.

**FRs covered:** FR3, FR4 (HVAC), FR5, FR6, FR7, FR-NEW-10, FR-NEW-11

---

### Story 11.1: HVAC RTU/AHU Equipment Screen

As an Auditor,
I want a per-unit RTU/AHU data entry screen with all nameplate, capacity, and control fields from the spec,
So that each rooftop or air-handling unit is captured individually rather than as a lumped HVAC blob.

**Acceptance Criteria:**

**Given** an Auditor enters the HVAC section,
**When** the HVAC screen tree loads,
**Then** the first sub-screen is "RTU/AHU List" showing a list of units with "Add RTU/AHU" and per-unit completion status (Not Started / In Progress / Complete)

**Given** the Auditor taps "Add RTU/AHU",
**When** the unit detail screen loads,
**Then** all fields per `Supermarket_EA.csv` HVAC RTU/AHU rows are shown — Make, Model, TR (capacity), Heating type (Natural gas / Electricity / Propane / Other), CFM, Fan speed control, % damper opening, Areas of the store served — with required fields marked `*` and help tooltips per field

**Given** an Auditor enters a Make/Model not in the listed-table dropdown,
**When** they confirm "Other",
**Then** a manual-entry text field appears and the entered value is flagged for admin review (analogous to FR45 compressor pattern)

**Given** an Auditor taps "Next" with required fields empty,
**When** attempt-first validation runs,
**Then** unfilled required fields get red border + shake animation; the "Next" button label shows "N required fields remaining" — matching the cross-cutting pattern from Story 3.1

**Given** the Auditor taps "Duplicate RTU/AHU",
**When** duplication runs (FR7 / FR-NEW-10),
**Then** a new unit screen opens with all non-unique fields (Make, Model, Heating type, Areas served defaults) pre-filled from the source unit

---

### Story 11.2: HVAC Exhaust Fan & Make-Up Air Screens

As an Auditor,
I want dedicated screens for Machine Room exhaust fans, kitchen exhaust hoods, and make-up air units,
So that each exhaust/intake path is captured with its own working-condition, HP, and control fields.

**Acceptance Criteria:**

**Given** an Auditor reaches the "Exhaust & MAU" sub-section of HVAC,
**When** the screen loads,
**Then** three screen groups are presented per `Supermarket_EA.csv`: Machine Room exhaust fan (HP, thermostat set point, Working?), Kitchen exhaust hood (Make, Model), and Make-Up Air for kitchen exhaust (Yes/No + linked MAU unit)

**Given** the Auditor enters Machine Room exhaust fan data,
**When** the field "Working?" is set to "No",
**Then** the Comments field is required (validation: "Note required when fan is non-working") so the data flows to a maintenance-call recommendation downstream

**Given** the Auditor reaches the picture sub-screen,
**When** the screen renders,
**Then** required photo Pic #8 (exhaust fan) and Pic #9 (ventilation) are enforced per Epic 14 patterns — sample reference image shown, framing instruction provided

**Given** the kitchen exhaust hood is marked "Not present",
**When** the Auditor taps "Next",
**Then** the make-up air sub-screen is skipped and the breadcrumb advances directly to HVAC Ventilation; the skip is recorded in `audits.hvac_data` so it survives resume

---

### Story 11.3: HVAC Ventilation & Damper Control Screen

As an Auditor,
I want a Ventilation screen capturing type, exhaust connection, set points, and damper control,
So that the HVAC ventilation strategy is fully captured for the energy baseline calculation.

**Acceptance Criteria:**

**Given** an Auditor reaches the HVAC Ventilation screen,
**When** the screen loads,
**Then** all fields per `Supermarket_EA.csv` ventilation rows are shown — Type (Forced/Natural), Connected to Exhaust (Yes/No), Operating logic (free text/dropdown), Set point ON (°F), Set point OFF (°F), Control by (Thermostat/Controller/None), CO2 sensor (Yes/No)

**Given** Type is set to "Natural",
**When** the form re-renders,
**Then** Set point ON/OFF and Control by fields are hidden (not applicable to natural ventilation) and not required for "Next"

**Given** the Auditor taps the `?` icon on "Operating logic",
**When** the help tooltip opens,
**Then** the tooltip text from the CSV ("Forced ventilation is when a fan is bringing fresh air in the machine room. Natural ventilation is when fresh air is coming through an opening in the outside wall, Louvers or through the roof") is displayed verbatim

**Given** all required Ventilation fields are complete,
**When** the Auditor taps "Next",
**Then** the screen advances to HVAC Controls; auto-save persists the screen via PATCH `/api/v1/audits/:id/sections/hvac`

---

### Story 11.4: HVAC Controller & Operating Schedule Screen

As an Auditor,
I want an HVAC Controls screen capturing controller make/model, system coverage, and operating schedule,
So that the HVAC control strategy is captured separately from the refrigeration controller (per `Listed table.csv` HVAC controls vs. Ref controls distinction).

**Acceptance Criteria:**

**Given** an Auditor reaches the HVAC Controls screen,
**When** the screen renders,
**Then** the fields per `Supermarket_EA.csv` HVAC controls rows are shown — Controller Make (CPC/MicroThermo/Danfoss/Thermostat/Other), Model, System Covered (HVAC / HVAC and Lighting / Lighting), Operating schedule (per day-of-week)

**Given** "System Covered" is set to "HVAC and Lighting",
**When** the Auditor proceeds,
**Then** the Lighting Controls screen (Story 12.3) pre-fills Controller Make/Model from this entry to avoid duplicate data entry

**Given** an Auditor enters a controller schedule,
**When** they tap each day-of-week chip,
**Then** start/end time pickers open with the General-section operating hours (1.03) pre-populated as defaults; Auditor can override

**Given** the HVAC Controls screen is complete,
**When** the Auditor taps "Next",
**Then** the HVAC SectionCard updates to "Complete" and Section Overview reflects HVAC progress; this story replaces the equivalent acceptance criterion in Story 5.2

---

### Story 11.5: HVAC Required-Photos Aggregate Screen

As an Auditor,
I want a final HVAC photos checklist confirming all required HVAC photos are captured,
So that I cannot leave the HVAC section with missing photos that would force a return-visit.

**Acceptance Criteria:**

**Given** an Auditor reaches the end of the HVAC section,
**When** the "HVAC Photos Checklist" screen renders,
**Then** a list of all required HVAC photos (Pic #8 exhaust, #9 ventilation, RTU/AHU nameplate per unit, Controller display) is shown with a green ✓ next to captured items and a red ⚠ next to missing items — derived from photo records bound to HVAC context (Epic 14)

**Given** any required HVAC photo is missing,
**When** the Auditor taps "Mark HVAC Complete",
**Then** the action is blocked with a clear message ("N HVAC photos still required") and tapping a missing item navigates the auditor back to that capture screen

**Given** all required HVAC photos are present,
**When** the Auditor taps "Mark HVAC Complete",
**Then** the HVAC SectionCard turns green ✓ and the Auditor is returned to the Section Overview

---

## Epic 12: Lighting & Building Envelope — Detailed Screens

Auditor completes Lighting and Building Envelope at screen level, replacing the lumped Story 5.3.

**FRs covered:** FR3, FR4 (Lighting, BldgEnv), FR5, FR6, FR-NEW-11

---

### Story 12.1: Interior Lighting Screens

As an Auditor,
I want per-area interior lighting screens capturing fixture type, count, wattage, manufacturer, and controls,
So that interior lighting energy consumption can be calculated per zone (retail floor, cooler/freezer, prep, office, washroom, etc.).

**Acceptance Criteria:**

**Given** an Auditor enters the Lighting section,
**When** the screen tree loads,
**Then** the first sub-screen is "Interior Lighting — Areas" listing each store area from `Listed table.csv` Lighting location column (Outdoor walls, Parking lot, Signage, Retail, Office, Washroom, Cooler, Freezer, Case lights, Vestibule, Fish prep, Dairy, Bakery, Cashier — interior subset) with completion status

**Given** an Auditor taps an area (e.g., "Retail"),
**When** the area detail screen loads,
**Then** fields per `Supermarket_EA.csv` lighting rows are shown — Lighting type (LED/Fluorescent/HID/Incandescent/Other), Lighting Wattage, Lighting Manufacturer, Quantity of fixtures, Controls (Photocell/Timer/Controller/No controls/Other)

**Given** Lighting type is set to "LED" and the Manufacturer dropdown opens,
**When** the dropdown renders,
**Then** values are sourced from `Listed table.csv` Lighting Manufacturer column (Philips, ECE, Other, etc.) — Auditor can pick "Other" to enter manually (flagged for admin review per FR45 pattern)

**Given** an Auditor taps "Duplicate Area",
**When** duplication runs (FR7 / FR-NEW-10),
**Then** a new area entry is created with Lighting type, Wattage, Manufacturer, and Controls pre-filled from the source area; Quantity resets to 0 (must be re-entered)

**Given** all required fields for an area are complete,
**When** the Auditor taps "Next",
**Then** the area card on the Interior Lighting list updates to "Complete" (green + ✓)

---

### Story 12.2: Exterior Lighting Screens

As an Auditor,
I want exterior lighting screens for parking lot, signage, building exterior, and other outdoor zones,
So that exterior lighting load is captured for the energy baseline and can drive outdoor-lighting ECMs.

**Acceptance Criteria:**

**Given** an Auditor proceeds from Interior Lighting to Exterior Lighting,
**When** the screen renders,
**Then** the area list includes Outdoor walls, Parking lot, Signage (per `Listed table.csv` Lighting location column, exterior subset)

**Given** an Auditor opens the Parking Lot lighting screen,
**When** the form renders,
**Then** all fields per CSV are shown plus Outdoor lights On (Yes/No) cross-referenced from General screen 1.03.5 — pre-filled and read-only with a "Edit in General" link

**Given** an Auditor enters Signage lighting,
**When** Lighting type is "LED" or "Fluorescent",
**Then** an additional field "Operating hours per day" is shown (since signage often runs 24/7); for "HID" / "Incandescent" the field defaults to 12 with override allowed

**Given** all exterior lighting areas are complete,
**When** the Auditor taps "Next",
**Then** the screen advances to Lighting Controls (Story 12.3)

---

### Story 12.3: Lighting Controls & Schedule Screen

As an Auditor,
I want a single Lighting Controls screen capturing the master control strategy and schedule,
So that lighting control logic is captured once and not repeated per area.

**Acceptance Criteria:**

**Given** an Auditor reaches the Lighting Controls screen,
**When** the screen renders,
**Then** fields per CSV are shown — Lighting controls master type (Photocell / Timer / Controller / No controls / Other), Controller Make + Model (only if "Controller"), per-zone schedule overrides

**Given** the HVAC Controls screen (Story 11.4) was completed with "System Covered = HVAC and Lighting",
**When** Lighting Controls renders,
**Then** Controller Make and Model are pre-filled from HVAC Controls; Auditor can override

**Given** "Lighting controls" is set to "No controls",
**When** the form re-renders,
**Then** schedule fields are hidden; an info banner reads "No automated controls — lighting runs continuously per posted hours"

**Given** the Lighting Controls screen is complete,
**When** the Auditor taps "Next",
**Then** the Lighting SectionCard updates to "Complete" (green + ✓)

---

### Story 12.4: Building Envelope — Roof, Walls, Insulation Screen

As an Auditor,
I want a Building Envelope structural screen capturing roof, wall, and insulation data,
So that envelope thermal performance is captured for the energy baseline (CDD/HDD regression).

**Acceptance Criteria:**

**Given** an Auditor enters the Building Envelope section,
**When** the first screen loads,
**Then** fields per spec (screen 5) are shown — Roof type, Roof colour, Insulation R-value (estimate), Wall construction type, Wall insulation, Year of last envelope renovation

**Given** R-value is "Unknown",
**When** the Auditor proceeds,
**Then** the field is recorded as null with a flag `envelope_r_unknown=true` so the calculation engine substitutes a sector-default value (Story 8.2 baseline)

**Given** required fields are complete,
**When** the Auditor taps "Next",
**Then** the screen advances to Doors/Windows/Vestibule (Story 12.5); auto-save persists `audits.building_envelope_data` JSON column per existing data model

---

### Story 12.5: Building Envelope — Doors, Windows, Vestibule Screen

As an Auditor,
I want a Doors/Windows/Vestibule screen capturing entry door type, vestibule presence, window glazing, and air-curtain presence,
So that infiltration losses are captured for the calculation engine.

**Acceptance Criteria:**

**Given** an Auditor enters the Doors/Windows/Vestibule screen,
**When** the screen renders,
**Then** fields per spec are shown — Entry door type (Manual / Auto-sliding / Revolving), Vestibule present (Yes/No), Vestibule type (Single doors / Double doors), Air curtain present (Yes/No), Window area (sq ft estimate), Window glazing (Single / Double / Low-E)

**Given** "Vestibule present" is set to "No",
**When** the form re-renders,
**Then** Vestibule type field is hidden and not required

**Given** all Building Envelope screens are complete,
**When** the last envelope screen is submitted,
**Then** the Building Envelope SectionCard turns green ✓; SectionProgressBar reflects the updated count

**Given** the Auditor reaches the envelope photos screen,
**When** the screen renders,
**Then** required photos (front of store, entry door, exit door, vestibule) per `Supermarket_EA.csv` Pic #1, #2, #3 are enforced per Epic 14 patterns

---

### Story 12.6: Lighting & Envelope Required-Photos Aggregate

As an Auditor,
I want a final Lighting + Envelope photos checklist screen,
So that I cannot mark these sections complete with missing photos.

**Acceptance Criteria:**

**Given** an Auditor reaches the end of Lighting and Building Envelope,
**When** the aggregate photos checklist screen renders,
**Then** all required photos (per-area lighting nameplate sample, exterior storefront, entry/exit doors, vestibule) are listed with ✓ / ⚠ status

**Given** any required photo is missing,
**When** the Auditor taps "Mark Complete",
**Then** the action is blocked with the same N-photos-remaining message used in Story 11.5

**Given** all required photos are captured,
**When** the Auditor taps "Mark Complete",
**Then** both Lighting and Building Envelope SectionCards turn green ✓ and the Auditor is returned to the Section Overview

---

## Epic 13: Refrigeration Sub-Equipment — Deep Screens

Auditor completes screen-level data entry for Condenser, Walk-In, Display Case, Conv Unit, Systems, and Controller deep sub-tree, replacing the lumped Stories 3.4 and 3.5.

**FRs covered:** FR3, FR4 (refrigeration), FR5, FR6, FR7, FR-NEW-10, FR-NEW-11

---

### Story 13.1: Condenser Deep Screens (2.501–2.509)

As an Auditor,
I want screen-level Condenser data entry with separate sub-screens for general info, coil pictures, motor pictures, and control panel,
So that condenser data captured matches the per-screen structure in `Ref_Condenser.csv` rather than a single lumped screen.

**Acceptance Criteria:**

**Given** an Auditor navigates from a Rack to its Condenser,
**When** the Condenser sub-tree loads,
**Then** screens per `Ref_Condenser.csv` are presented in order: 2.501 General (Name, Make, Model, Age, Power supply, Quantity of fans, Fan configuration, HP per fan, Damaged motor count, Coil condition, Motors control, Refrigerant), 2.502 Picture Nameplate, 2.503 Circuit Details, 2.5031 Picture Circuit, 2.504 Picture Coil, 2.505 Picture Water Spray, 2.506 Picture Fans, 2.507 Picture Motor, 2.508 Picture Control Panel, 2.509 Picture Thermostat

**Given** the Auditor reaches screen 2.501 Condenser General,
**When** the form renders,
**Then** required fields marked `*` per CSV (Condenser Name only); other fields use dropdown values from `dropdown.csv` and `Listed table.csv` Condenser fan motor / Motor HP / Cover columns

**Given** Motors control is set to "VFD" or "ECM",
**When** the form re-renders,
**Then** an additional sub-section "VFD/ECM Details" appears with Make/Model fields sourced from `Listed table.csv` VFD Make column (ABB / SIEMENS / Danfoss / Other)

**Given** the Auditor taps "Duplicate Condenser" from the Rack screen,
**When** duplication runs (FR-NEW-10),
**Then** a new Condenser entry is created with all non-unique fields pre-filled from the source

**Given** Quantity of motors damaged > 0,
**When** the Auditor proceeds,
**Then** Comments is required ("Describe damaged motors for maintenance call") — same pattern as HVAC Story 11.2

---

### Story 13.2: Walk-In Deep Screens (2.601–2.6013)

As an Auditor,
I want screen-level Walk-In data entry with separate sub-screens for general, doors, room, evaporator general/electrical, and pictures,
So that each Walk-In box's evaporator and door integrity is captured at the level of fidelity required for ECM analysis.

**Acceptance Criteria:**

**Given** an Auditor navigates to a Walk-In,
**When** the Walk-In sub-tree loads,
**Then** screens per `Ref_WI.csv` are presented in order: 2.6010 Walk-In General (Name, Connected Rack/CU#, Suction group, Measured temp, Gauge temp, Frosting Y/N, Door seal, Alarm, Plastic curtains, Comments), 2.6011 Picture Doors, 2.6012 Picture Room, 2.6013 Evaporator General, 2.60130 Evaporator Electrical, 2.60131 Evaporator Picture, 2.60132 Picture Evaporator, 2.60133 Picture Evaporator Nameplate

**Given** Frosting Y/N is "Yes",
**When** the Auditor proceeds,
**Then** a follow-up dropdown "Frost location" (Ceiling / Door / Side walls / Multiple) is required and Comments must include the location detail

**Given** the Auditor taps "Add another Walk-In",
**When** a new walk-in entry is created,
**Then** the breadcrumb shows "Refrigeration › Rack N › Walk-In M"; entry duplication ("Copy from Walk-In M-1") is available per FR-NEW-10

**Given** Door seal is "Poor",
**When** the Auditor proceeds,
**Then** required photo Pic 2.6011 (doors) gates the Walk-In completion — auditor cannot mark this Walk-In complete without it (Epic 14)

**Given** all Walk-Ins for the Rack are complete,
**When** the Auditor taps "Next" on the Walk-In list,
**Then** the navigation advances to Display Cases (Story 13.3)

---

### Story 13.3: Display Case Deep Screens (2.701–2.7010)

As an Auditor,
I want screen-level Display Case data entry with separate sub-screens for system grouping, case general 1/2/3, front pictures, and nameplate pictures,
So that each case is captured at the per-screen detail in `Ref Display.csv`.

**Acceptance Criteria:**

**Given** an Auditor navigates from a Rack/System to Display Cases,
**When** the Display Case sub-tree loads,
**Then** screens per `Ref Display.csv` are presented: 2.701 Display Case System # (where 1 case is auto-added by default per CSV note), 2.7010 Enter Case # (1+ cases per system), 2.70100 Display Case General 1, 2.70101 Display Case General 2, 2.70102 Display Case General 3, 2.70103 Picture Case Front, 2.70104 Picture Case Nameplate

**Given** Case Type is set to "Medium Temp.",
**When** the Length field renders,
**Then** the unit is "Linear Feet" with options 2', 4', 6', 8', 12' (per CSV); for "Low Temp." the unit becomes "Doors" with options 1-Door through 6-Door

**Given** Cover type is "With Doors" or "With Night Curtains",
**When** the Auditor proceeds,
**Then** a follow-up boolean "Covers in working order" is required; if "No", Comments is mandatory

**Given** Case Condition is "Poor",
**When** the Auditor proceeds,
**Then** required photo Pic 2.70103 (case front) gates completion (Epic 14)

**Given** the Auditor taps "Duplicate Case",
**When** duplication runs (FR-NEW-10),
**Then** a new case is created with non-unique fields (Make, Model, Cover type, Length unit) pre-filled; Case Number auto-increments

---

### Story 13.4: Conventional Unit Deep Screens (2.401–2.406)

As an Auditor,
I want screen-level Conventional Unit (single-compressor stand-alone unit) data entry with separate sub-screens for general 1, general 2, electrical, and unit/nameplate/oil-pot pictures,
So that conventional units (small stand-alone refrigeration) are captured at the same detail as racks.

**Acceptance Criteria:**

**Given** an Auditor reaches the Conventional Units list,
**When** the Conv Unit sub-tree loads,
**Then** screens per `Ref_Conv Unit.csv` are presented: 2.401 Conv Unit General 1 (Name, Connected system #, Refrigerant, Compressor Make/Model, Suction group, Working condition, Speed control), 2.402 General 2, 2.403 Electrical, 2.404 Picture Conv Unit, 2.405 Picture Nameplate, 2.406 Picture Oil Pot

**Given** Compressor Speed control is set to "VFD" or "Digital discuss",
**When** the form re-renders,
**Then** an additional VFD Make/Model sub-field appears (sourced from `Listed table.csv` VFD column)

**Given** Compressor in working condition is "No",
**When** the Auditor proceeds,
**Then** required Comments must specify whether the unit is electrically and mechanically isolated (per CSV instruction text)

**Given** the Auditor taps "Duplicate Conv Unit",
**When** duplication runs (FR-NEW-10),
**Then** a new Conv Unit is created with non-unique fields pre-filled

---

### Story 13.5: Refrigeration Systems Deep Screens (2.901–2.9010)

As an Auditor,
I want screen-level Systems data entry per Rack with separate sub-screens for system general, suction line picture, liquid line picture, and defrost picture,
So that per-system EPR, line size, and defrost data are captured (currently lumped).

**Acceptance Criteria:**

**Given** an Auditor reaches the Systems sub-tree under a Rack,
**When** the screens load,
**Then** screens per `Ref_Systems.csv` are presented: 2.901 Select Rack, 2.9010 Enter System #, 2.90100 System General (System #, Temp group, Type of EPR, Make of EPR, Model of EPR, Insulation status, Suction line size, Liquid line size, Comments), 2.90101 Picture System Suction Line, 2.90102 Picture System Liquid Line, 2.90103 Picture System Defrost

**Given** Type of EPR is "Mechanical",
**When** the EPR Make dropdown opens,
**Then** values are scoped to mechanical EPRs per `Listed table.csv` Valve Manufacturers + EPR Make columns (Parker / Sporlan / Other); for "Electronic" the dropdown shows electronic EPRs (Danfoss AKS / Other)

**Given** Insulation status of the line is "Poor",
**When** the Auditor proceeds,
**Then** required photo Pic 2.90101 (suction line) gates completion (Epic 14) so the calc engine has visual evidence

**Given** all Systems for the Rack are complete,
**When** the Auditor taps "Next",
**Then** the navigation advances back to the Rack list with the Systems-complete count updated on the Rack card

---

### Story 13.6: Controller Deep Sub-Tree (2.803–2.80308)

As an Auditor,
I want the deep Controller sub-tree screens (Refrigeration Controls / Suction Pressure Controls / Head Pressure Controls / System Controls) with their picture sub-screens,
So that controller setpoints and control strategy pictures are captured at the per-rack and per-suction-group level.

**Acceptance Criteria:**

**Given** an Auditor reaches Refrigeration Controls (2.803),
**When** the sub-tree loads,
**Then** screens per `Ref_Controller.csv` and Screens.csv col 23 are presented in order: 2.8030 Select Rack, 2.80300 Picture Rack Loading, 2.80301 Select Suction Group, 2.803010 Suction Group General, 2.803011 Suction Pressure Controls, 2.803012–2.803016 Picture Suction (5 pictures: setpoint screen, loading graph, actual pressure 24h, actual pressure 1 week, VFD compressor loading), 2.80302 Head Pressure Controls, 2.80303–2.80307 Picture Head Pressure (5 pictures), 2.80308 System Controls, 2.803080 System General, 2.803081 Picture System Control, 2.803082 Enter Case/Walk-in #, 2.8030820 General Case/Walk-in Details

**Given** the Auditor enters Suction Pressure Controls (2.803011),
**When** the form renders,
**Then** fields are: Pressure type (Discharge / Dropleg / Other), Floating Strategy (TD with Min / Min Temp only / Other), TD Control Setpoint (5/10/15/20/25), Defrost termination type (Time / Temperature / Other) — sourced from `Listed table.csv` Pressure type / Floating Strategy / TD setpoint / Defrost termination columns

**Given** Floating Strategy is "TD control with Min",
**When** the Auditor proceeds,
**Then** the TD Control Setpoint field is required; otherwise it is hidden

**Given** the Auditor reaches the 5 head-pressure picture screens (2.80303–2.80307),
**When** each picture screen renders,
**Then** each is gated as "Required only if floating head pressure is enabled on this Rack" — if floating head was set to "No" on the Rack, these screens are skipped automatically

**Given** the Auditor reaches Enter Case/Walk-in # (2.803082),
**When** the screen renders,
**Then** the dropdown is populated with all cases and walk-ins entered earlier in the audit (Story 13.2 + 13.3) — Auditor selects the items controlled by this controller; selection drives the calc engine's per-case/walk-in pull-down on temperature alarms

---

## Epic 14: Required-Photo Discipline & Sample Image Flow

Cross-cutting epic establishing the universal photo-capture pattern across all sections.

**FRs covered:** FR11, FR12, FR13, FR14, FR15, FR-NEW-11

---

### Story 14.1: Sample Reference Image Display Per Photo Screen

As an Auditor,
I want every photo-required screen to show a sample reference image and framing instructions before I open the camera,
So that captured photos are framed consistently and admin/calc engine can rely on photo content (FR12 / FR-NEW-11).

**Acceptance Criteria:**

**Given** an Auditor reaches any photo-required screen,
**When** the screen renders,
**Then** the layout shows: (1) Photo title (e.g., "Picture of Compressor Nameplate"), (2) Framing instructions text from the CSV, (3) Sample reference image (from `assets/sample-photos/{screen-id}.jpg`), (4) "Open Camera" primary button, (5) Optional "Skip — Not Visible" with required justification

**Given** the sample image asset is missing for a screen,
**When** the screen renders,
**Then** a placeholder ("Sample image not yet available") is shown with a non-blocking banner; the auditor can still capture; an admin alert is logged so missing-asset gaps are surfaced

**Given** an Auditor taps "Skip — Not Visible",
**When** the modal opens,
**Then** a justification dropdown is required (Equipment inaccessible / Equipment removed / Other with text); the skip is recorded in `audits.photo_skips` with auditor identity and timestamp — visible to admin in calc review

**Given** the Auditor taps "Open Camera",
**When** the camera opens,
**Then** an overlay shows the framing instruction text (semi-transparent) so the auditor can see the guide while framing the shot

---

### Story 14.2: Required-Photo Enforcement & Counter

As an Auditor,
I want a clear count of remaining required photos at each section level and at submission,
So that I never reach Submit with missing photos that would invalidate the audit.

**Acceptance Criteria:**

**Given** any section has required photos,
**When** the Section Overview SectionCard renders,
**Then** the card shows "Photos: X / Y" where Y is required count and X is captured count (or skipped-with-justification count)

**Given** any required photo is missing without skip-justification,
**When** the Auditor attempts to Mark Section Complete,
**Then** the action is blocked with "N required photos remaining in [section]"; tapping the message navigates to the first missing photo screen

**Given** the Auditor reaches Review & Submit (Story 5.4),
**When** the screen renders and any required photo is missing or pending upload,
**Then** the existing Story 5.4 acceptance criterion is reinforced — Submit remains disabled with the exact missing/uploading count visible

**Given** an Auditor skipped a required photo with justification,
**When** Review & Submit renders,
**Then** a warning section ("Skipped photos requiring admin review") lists the skips with justifications; submission is permitted but the audit is flagged on admin side

---

### Story 14.3: Photo Context Auto-Binding

As a Calc Engine / Admin,
I want every captured photo to be auto-tagged with section, screen-id, equipment-id, and audit-id at the point of capture,
So that photos can be retrieved by context (e.g., "all compressor nameplates for audit X") without manual tagging (FR13).

**Acceptance Criteria:**

**Given** an Auditor captures a photo from any screen,
**When** the photo is uploaded,
**Then** the photo metadata includes — `audit_id`, `section_id`, `screen_id` (e.g., "2.30102"), `equipment_id` (e.g., compressor UUID), `captured_at`, `auditor_id`, `device_id`, GPS lat/lng (if permitted)

**Given** the photo is captured under a sub-equipment context (e.g., Compressor 3 of Rack B),
**When** metadata is bound,
**Then** the equipment hierarchy path is stored as `context_path: "rack:B/suction-group:1/compressor:3"` for later retrieval and PDF report templating

**Given** the Auditor goes back via breadcrumb and re-takes the photo,
**When** the new photo is uploaded,
**Then** the previous photo is marked superseded (not deleted — kept for audit log per NFR-S4) and the new photo becomes the canonical one for that screen-equipment context

---

### Story 14.4: Additional Photos Beyond Required

As an Auditor,
I want to add unlimited additional photos at any screen beyond the required minimum,
So that unusual conditions or supporting context can be captured without inventing a custom workflow.

**Acceptance Criteria:**

**Given** an Auditor is on any photo-capable screen,
**When** the screen renders,
**Then** an "+ Add Photo" button is available beneath the required photo(s) — tapping it opens the camera with a generic framing prompt and no required-image gating

**Given** an additional photo is captured,
**When** it is uploaded,
**Then** it is bound to the same section/screen/equipment context (Story 14.3) with `is_required: false` so report templating can include or exclude based on content type

**Given** an Auditor adds 10+ additional photos to a single screen,
**When** the screen re-renders,
**Then** photos are shown in a horizontally-scrolling thumbnail strip; the upload queue handles them per Story 4.4 retry logic

---

### Story 14.5: Photo Caption / Comment Capture

As an Auditor,
I want to add a text comment alongside any photo,
So that contextual notes (e.g., "compressor 3 isolated due to seized bearing") travel with the photo to admin review and report.

**Acceptance Criteria:**

**Given** an Auditor captures or selects any photo,
**When** the photo preview renders,
**Then** a "+ Add Comment" link is available; tapping it opens a text field (max 500 chars)

**Given** a photo has a comment and is on a non-conformance screen (e.g., damaged motor, poor coil condition, frosting),
**When** the Auditor proceeds,
**Then** the comment is required (validated server-side); attempt-first validation flags the empty comment with red border

**Given** a photo with comment is uploaded,
**When** the upload completes,
**Then** the comment is persisted with the photo metadata (Story 14.3) and visible in admin photo viewer (Epic 7) with auditor name and timestamp

---

## Epic 15: Multi-Sector & Multi-Audit-Type Framework

System routes auditor through sector-specific and audit-type-specific screen subsets; admin configures the matrix without code changes.

**FRs covered:** FR3, FR-NEW-1, FR-NEW-2, FR-NEW-12

---

### Story 15.1: Audit Type Selection Screen

As an Auditor,
I want to pick the audit type (Energy Audit / HVAC Survey / Case Survey / Refrigeration Retrofit Survey / Lighting Survey) at the start of an audit,
So that the rest of the audit only shows the screens relevant to that engagement type.

**Acceptance Criteria:**

**Given** an Auditor selects a store and starts a new audit,
**When** the Audit Type screen renders (per `Screens.csv` "Audit Type" column),
**Then** the available audit types are listed — Energy Audit, HVAC Survey, Case Survey (a.k.a. Cooler/Freezer Survey for Cold Storage sector), Refrigeration Retrofit Survey, Lighting Survey

**Given** the Auditor selects an audit type,
**When** the selection is confirmed,
**Then** the audit record is stamped with `audit_type` and `audit_type_version`; only screens flagged for that type in the screen-config table are subsequently rendered

**Given** the Auditor selects "HVAC Survey",
**When** the Section Overview renders,
**Then** only General and HVAC SectionCards are shown — Refrigeration, Lighting, Building Envelope are hidden; "5 of 5 sections" copy adapts to "2 of 2"

**Given** the Auditor's role is "OEM/Internal Technician" (Story 1.7),
**When** the audit type list renders,
**Then** only the audit types permitted to OEM technicians are listed (per RBAC config) — others are hidden, not greyed-out

---

### Story 15.2: Sector Selection & Sector-Aware Screen Routing

As an Auditor,
I want to pick the sector (Supermarket / Cold Storage / Warehouse / Hospitality / Retail) at the start of the audit (or to have it pre-selected from the store record),
So that the screen flow shows the screen subset appropriate to that sector.

**Acceptance Criteria:**

**Given** the selected store has a `sector` attribute on its reference record,
**When** the Auditor starts an audit,
**Then** the sector is auto-populated from the store record and the Sector screen is skipped — Auditor proceeds straight to Audit Type

**Given** the store record has no sector or the auditor manually changes it,
**When** the Sector screen renders,
**Then** options per `Supermarket_EA.csv` Sector column are listed — Supermarket, Cold Storage, Warehouse, Hospitality, Retail

**Given** the Auditor selects "Cold Storage",
**When** subsequent screens load,
**Then** Lighting and Building Envelope SectionCards are hidden (per typical Cold Storage scope), Refrigeration screens emphasise Walk-In/Freezer over Display Cases, and HVAC screens emphasise dock/door insulation

**Given** the Auditor changes sector mid-audit (rare),
**When** the change is confirmed (with warning modal: "Changing sector may invalidate already-entered data"),
**Then** existing data is preserved but flagged on admin side as "sector changed mid-audit"

---

### Story 15.3: Audit-Type × Sector Screen Configuration

As an Admin,
I want to configure which screens appear for each (sector, audit-type) combination via a matrix UI,
So that we can extend the system to new sectors or audit types without code deployments (FR-NEW-12).

**Acceptance Criteria:**

**Given** an Admin opens "Settings → Audit Configuration",
**When** the page loads,
**Then** a matrix is shown with sectors as rows, audit types as columns, and a count of enabled screens per cell

**Given** an Admin clicks a (sector, audit-type) cell,
**When** the screen-config drawer opens,
**Then** all known screens (from the master screen registry) are listed with checkboxes; required-by-default screens (e.g., General 1.01 store-id) are checked and locked-on with an info icon

**Given** the Admin enables additional screens for a (sector, audit-type) pair,
**When** they save,
**Then** the configuration is persisted with `config_version`; audits in progress are NOT migrated (they keep their stamped version) — only new audits get the new screen set

**Given** an Admin attempts to disable a screen that is currently in use by in-progress audits,
**When** they save,
**Then** a confirmation modal warns "X in-progress audits use this screen — they will continue with the current version" and proceeds

---

### Story 15.4: Audit-Type-Aware Calculation Routing

As a Calc Engine,
I want to route an audit to the correct calculation pipeline based on its audit type,
So that an HVAC Survey doesn't trigger ECM refrigeration calcs, and a Lighting Survey only runs lighting-related calcs.

**Acceptance Criteria:**

**Given** an audit submitted with `audit_type = "Energy Audit"`,
**When** the calc dispatcher runs,
**Then** all calculation pipelines (ECM refrigeration savings + energy baseline + lighting payback) are invoked per Epic 8

**Given** an audit submitted with `audit_type = "HVAC Survey"`,
**When** the calc dispatcher runs,
**Then** only HVAC-related calculations are invoked (energy baseline scoped to HVAC load); ECM refrigeration calcs are skipped — the audit transitions DRAFT → IN_REVIEW → CALC_COMPLETE without refrigeration outputs

**Given** an audit type has no calculations defined (e.g., "Refrigeration Retrofit Survey" — survey only, no ECM math),
**When** the calc dispatcher runs,
**Then** the audit transitions IN_REVIEW → CALC_COMPLETE immediately with an empty `calc_results` block; LLM anomaly flagging is skipped

**Given** the audit-type-to-calc-pipeline mapping changes (admin reconfigures),
**When** an existing audit is re-run (Story 8.5),
**Then** it uses the calc pipeline mapping that was in effect when the audit was originally submitted (reproducibility per NFR-R3)

---

## Epic 16: Reference-Data Admin Expansion

Admin manages refrigeration equipment reference DBs (non-compressor), master dropdown library, listed-table sources, and data-point identity reference — all without code changes; with version stamping and audit logging.

**FRs covered:** FR43, FR44 (extended), FR-NEW-7, FR-NEW-8, NFR-S4

---

### Story 16.1: Refrigeration Equipment Reference DB Manager

As an Admin,
I want a unified reference-DB manager for Condenser, Walk-In, Display Case, Conv Unit, Rack, Systems, and Controller models — analogous to the existing Compressor DB manager (Story 6.2),
So that new equipment models discovered on-site can be added without engineering involvement (FR-NEW-7).

**Acceptance Criteria:**

**Given** an Admin opens "Reference Data → Equipment DBs",
**When** the page loads,
**Then** tabs are shown for each equipment family (Condenser / Walk-In / Display Case / Conv Unit / Rack / Systems / Controller); each tab lists models with Make, Model, status (active/retired), version, and "in-use audit count"

**Given** an Admin submits POST `/api/v1/equipment-models/{family}` with a new model's fields,
**When** the request is processed,
**Then** the new model is added; Redis cache key `equipment_db:{family}:v{version}` is invalidated and a new version is created; future auditor lookups return the updated model

**Given** an Admin retires a model,
**When** the model status is set to "retired",
**Then** the model no longer appears in auditor lookups; existing audits stamped with the prior version continue to use the version they were created with (NFR-R3)

**Given** an auditor entered a model on-site that was not in the DB (FR45 pattern, generalised),
**When** the Admin views the family-specific "Unknown Models" queue,
**Then** the submitted model's specs appear for review; Admin can promote it to the main DB in one action

**Given** any reference-DB write happens,
**When** the change is persisted,
**Then** an immutable audit-log entry is recorded with timestamp, admin identity, before/after diff, and reason (NFR-S4)

---

### Story 16.2: Dropdown Master-Data Admin

As an Admin,
I want to manage master dropdown values shared across screens via a single admin UI,
So that dropdown values (e.g., refrigerant types, oil types, motor configurations) can be updated centrally without code changes (FR-NEW-8).

**Acceptance Criteria:**

**Given** an Admin opens "Reference Data → Dropdowns",
**When** the page loads,
**Then** dropdowns from `dropdown.csv` are listed by name (Refrigerant, Oil Type, Compressor Make, Rack Make, Controller Make, etc.) with value count and "consumed by N screens" badge

**Given** an Admin opens a dropdown's detail page,
**When** the page renders,
**Then** values are listed in display order with: label, value-key, default flag, active flag, "in-use audit count"; Admin can reorder via drag, add new values, retire (not delete) existing values

**Given** an Admin attempts to delete a dropdown value that is in use,
**When** they save,
**Then** the action is blocked with "Value 'R22' is used by N audits; retire it instead" — retirement hides the value from new audits but preserves it for historical audits

**Given** an Admin updates the default value for a dropdown,
**When** they save,
**Then** the change applies only to NEW audits; in-progress audits keep their auto-saved selection

**Given** any dropdown change happens,
**When** the change is persisted,
**Then** an audit-log entry is created (NFR-S4); affected screens' Redis caches are invalidated

---

### Story 16.3: Listed-Table Source Admin

As an Admin,
I want to manage which listed-table sources feed which screen fields (per `Listed table.csv`),
So that field-to-source mappings can be reconfigured without code changes (FR-NEW-8).

**Acceptance Criteria:**

**Given** an Admin opens "Reference Data → Listed Tables",
**When** the page loads,
**Then** rows from `Listed table.csv` are presented as a mapping table: screen-field-id → listed-table source → status (active/retired)

**Given** an Admin opens a screen-field's mapping,
**When** the detail drawer opens,
**Then** the screen field, its current listed-table source, and a preview of the source values are shown; Admin can swap to a different listed-table source

**Given** an Admin swaps a screen field to a new source,
**When** they save,
**Then** the change applies to new audits; in-progress audits keep their stamped source version

**Given** a listed-table source is consumed by multiple screen fields,
**When** the Admin views the source detail,
**Then** all consumer screen fields are listed (read-only) so the Admin understands blast-radius before editing

---

### Story 16.4: Data-Point Identity Reference Admin

As an Admin,
I want to manage the master data-point identity reference (per `Data point.csv`),
So that the canonical mapping from screen-field-id to data-point category/calc-engine variable is editable centrally.

**Acceptance Criteria:**

**Given** an Admin opens "Reference Data → Data Points",
**When** the page loads,
**Then** all data-points from `Data point.csv` are listed grouped by category (EA.General / Store information / Service provider information / etc.)

**Given** an Admin opens a data-point's detail,
**When** the detail drawer opens,
**Then** screen-field-id (e.g., 1.01.1), label (e.g., "Project identification"), category, calc-engine variable name, and "consumed by calc pipelines" list are shown

**Given** an Admin renames a data-point label,
**When** they save,
**Then** the change is reflected in all consumer surfaces (admin views, report templates) but the underlying screen-field-id and calc-engine variable name are immutable (changing them would break reproducibility)

**Given** any data-point change happens,
**When** the change is persisted,
**Then** an audit-log entry is created (NFR-S4)

---

### Story 16.5: Reference-Data Version Stamping & Cross-Reference Report

As an Admin,
I want a single page showing all reference-data versions in effect for any given audit,
So that I can answer "what version of compressor DB / dropdowns / equipment models did this audit use?" without database digging.

**Acceptance Criteria:**

**Given** an Admin opens any audit detail,
**When** the "Reference Data Snapshot" tab is opened,
**Then** all stamped versions are shown: `compressor_db_version`, `equipment_db_versions` (per family), `dropdown_version`, `listed_table_version`, `data_point_version`, `audit_type_config_version`

**Given** the Admin clicks any version,
**When** the version detail opens,
**Then** the exact reference data values in effect at that version are shown (not the current values) — so the audit's calc inputs can be perfectly reproduced (NFR-R3)

**Given** a reference-data export is requested,
**When** the Admin clicks "Export Snapshot",
**Then** a JSON bundle of all versioned reference data is generated and downloadable — useful for offline reproducibility analysis or QA replay

---

## Epic 17: Contractor Depository

Service Provider uploads pictures, quotes, and supporting documents to a depository area scoped to assigned sites; admin reviews, categorises, and links items to specific audits or report sections.

**FRs covered:** FR-NEW-5, FR-NEW-9, NFR-S2, NFR-S3

---

### Story 17.1: Service Provider Login & Site Scope

As a Service Provider,
I want to log in to a depository-only surface and see only my assigned sites,
So that I can upload supporting materials without access to audit data, calculations, or reports (FR-NEW-5).

**Acceptance Criteria:**

**Given** a Service Provider account is created by an Admin (Story 1.7),
**When** the Service Provider logs in,
**Then** they land on the Depository surface — not the Audit App, not the Admin Console, not the Client Portal; routes to those surfaces return 403 (per Epic 1's role-based guards extended)

**Given** the Service Provider's site assignments are stored in the `service_provider_assignments` table,
**When** the Depository home loads,
**Then** only assigned sites are listed; Azure SQL RLS enforces this at the DB layer (NFR-S3) — bypassing the UI is not possible

**Given** the Service Provider opens a site,
**When** the site detail loads,
**Then** they see only depository-related tabs (Pictures / Quotes / Documents) — no audit data, no calc results, no reports

---

### Story 17.2: Document/Photo/Quote Upload to Depository

As a Service Provider,
I want to upload pictures, quotes, and supporting documents (PDFs / images / Word / Excel) against a site,
So that the auditor and admin have access to the field-level evidence I gathered.

**Acceptance Criteria:**

**Given** a Service Provider opens a site's Depository,
**When** they tap "Upload",
**Then** a file picker accepts images (jpg/png/heic), PDFs, Word, Excel; max 50 MB per file; max 50 files per upload batch

**Given** a file is uploaded,
**When** the upload completes,
**Then** it is stored in Azure Blob (`depository/{tenant}/{site}/{file-id}`) with state-gated SAS access (read-only for assigned-site auditors and tenant admins; write for the uploader) — encrypted at rest (NFR-S2)

**Given** the file is an image,
**When** it is uploaded,
**Then** thumbnail generation runs as a job (`cems:thumbnail-gen`) and a thumbnail is rendered in the depository grid; original is preserved at full resolution

**Given** the file is a quote (PDF) and the Service Provider tags it with `category: quote`,
**When** the upload completes,
**Then** an in-app alert is sent to the assigned tenant admin: "New quote uploaded by [Service Provider] for [Site]"

**Given** the upload fails (network, file too large, unsupported format),
**When** the failure occurs,
**Then** the user is shown a clear error per file in the batch; successful uploads in the batch are not rolled back

---

### Story 17.3: Admin Depository Review & Audit Linkage

As an Admin,
I want to review depository items per site and link relevant items to specific audits or report sections,
So that contractor quotes, pre-audit photos, and supporting documents flow into the final report appropriately.

**Acceptance Criteria:**

**Given** an Admin opens a site's Depository,
**When** the page loads,
**Then** all uploaded items are listed grouped by category (Pictures / Quotes / Documents / Other) with uploader name, timestamp, and a "linked to audit" status (Yes / No / N/A)

**Given** an Admin selects an item and chooses "Link to audit",
**When** the link drawer opens,
**Then** all audits for that site are listed; Admin picks one and (optionally) a section context (General / Refrigeration / HVAC / Lighting / Envelope / Report Appendix); link is persisted

**Given** an item is linked to an audit currently in DRAFT,
**When** the audit's auditor opens it,
**Then** linked depository items appear in a "Pre-collected materials" panel on the relevant section; auditor can view but not delete depository items

**Given** an item is linked to an audit currently in CALC_COMPLETE or APPROVED,
**When** the link is created,
**Then** the link is recorded but does not retroactively trigger calc re-runs; if the link should affect the report, Admin must explicitly request report regeneration (Story 9.5 pattern)

**Given** an Admin recategorises an item,
**When** the change is saved,
**Then** an audit-log entry is recorded (NFR-S4); the uploader is not notified (categorisation is internal to admin)

---

### Story 17.4: Depository Items in Final Report

As an Admin,
I want depository items linked to a report-section context to appear in the generated PDF report,
So that quotes and supporting evidence are bundled with the final deliverable to the client.

**Acceptance Criteria:**

**Given** an audit reaches APPROVED with depository items linked to its sections,
**When** PDF generation runs (Epic 9),
**Then** linked images appear in the relevant section's photo block; linked PDFs/quotes appear in the appendix with a Table of Contents entry "Supporting Materials"

**Given** a depository item is linked but flagged "internal only" by Admin,
**When** PDF generation runs,
**Then** the internal-only item is excluded from the client-facing PDF but included in an admin-only PDF variant (if generated)

**Given** the linked depository file fails to load during PDF generation (e.g., blob access error),
**When** Puppeteer encounters the failure,
**Then** the report generation does not crash — the item is replaced with a placeholder ("Supporting material temporarily unavailable") and the failure is logged for admin attention

---

## Additions to Epic 1: Authentication & User Management

These extend the existing Epic 1 (which currently covers email/password login, role-based surface access, auditor and client account management for a 3-role model).

---

### Story 1.5: OTP Second Factor at Login

As a User of any role,
I want an OTP second factor at login (email or SMS),
So that account access requires both password and possession of a registered channel (FR-NEW-3).

**Acceptance Criteria:**

**Given** a user submits email + password successfully,
**When** the password check passes,
**Then** the API issues a short-lived `otp_pending_token` (5 min TTL) and dispatches a 6-digit OTP via the user's preferred channel (email default; SMS optional if phone is registered) — JWT is NOT issued yet

**Given** the OTP is sent,
**When** the user enters the OTP within TTL,
**Then** the API validates and issues the JWT per role (Auditor 8h, Admin/Client 4h per NFR-S6)

**Given** the user enters an incorrect OTP,
**When** the validation fails,
**Then** failure is logged; after 5 failures the `otp_pending_token` is invalidated and the user must re-enter password

**Given** the user does not enter the OTP within TTL,
**When** the TTL expires,
**Then** the OTP screen shows "Code expired — please try again" with a "Resend OTP" button (max 3 resends per password attempt)

**Given** the user has Trusted Device enabled (post-MVP — flagged but not built),
**When** they log in from that device,
**Then** OTP is bypassed — this story documents the seam but does not implement Trusted Device

---

### Story 1.6: Super Admin Tier — Cross-Tenant Administration

As a Super Admin (Star Energy internal),
I want a tier above per-tenant Admin with cross-tenant administration capabilities,
So that the Star Energy team can manage multiple tenants (clients' organisations) from one account (FR-NEW-4).

**Acceptance Criteria:**

**Given** a Super Admin authenticates,
**When** the Admin Console loads,
**Then** a tenant switcher in the header lists all tenants; the active tenant scopes all RLS queries; switching tenants is logged in NFR-S4 audit log

**Given** a Super Admin is in tenant context,
**When** they perform any Admin action (Stories 1.3, 1.4, 6.1, 6.2, etc.),
**Then** the action behaves identically to a tenant Admin's — there is no special "all tenants" multi-write pattern (avoids accidental blast-radius)

**Given** a Super Admin opens "Cross-Tenant" page,
**When** the page loads,
**Then** a read-only summary is shown — tenant count, active audits per tenant, storage usage per tenant — no per-record drill-down

**Given** a tenant Admin attempts to access cross-tenant routes,
**When** the request hits the API,
**Then** 403 is returned (no leakage of cross-tenant route existence)

**Given** a Super Admin creates a new tenant,
**When** the tenant is provisioned,
**Then** initial tenant Admin invite is sent; Super Admin is NOT auto-assigned as a member of the new tenant (must explicitly switch context to act in it)

---

### Story 1.7: Service Provider & OEM Roles — Capability Enforcement

As an Admin,
I want to provision Service Provider and OEM/Internal Technician accounts with strictly-scoped capabilities,
So that contractors and OEMs get the access they need without exposing audit data, calculations, or reports (FR-NEW-5, FR-NEW-6).

**Acceptance Criteria:**

**Given** an Admin opens "User Management → New Account",
**When** the role dropdown opens,
**Then** roles per `RBAC.csv` are listed — Auditor, Service Provider, OEM/Internal Technician (in addition to Auditor and Client from existing stories)

**Given** an Admin creates a Service Provider account with site assignments,
**When** the account is provisioned,
**Then** the Service Provider can access only the Depository surface for assigned sites (Story 17.1) — Audit App, Admin Console, Client Portal, and Calc/Report APIs return 403

**Given** an Admin creates an OEM/Internal Technician account,
**When** the account is provisioned,
**Then** the OEM can access only the Audit App in data-collection mode for explicitly assigned sites — they can submit audits but cannot view calc results, reports, or admin views; they cannot see other auditors' drafts

**Given** an Admin attempts to grant an OEM cross-site access,
**When** the assignment is saved,
**Then** the system enforces a per-site assignment limit (configurable; default 10) — soft warning beyond limit, hard block at 50 — to prevent role-misuse

**Given** any role-related capability change happens (role assignment, site assignment, capability matrix edit),
**When** the change is persisted,
**Then** an audit-log entry is recorded (NFR-S4) with before/after diff

---

## Additions to Epic 3: Refrigeration Data Collection

### Story 3.7: Generalised Copy-from-Previous for All Sub-Equipment

As an Auditor,
I want the "Copy from Previous" / "Duplicate" pattern (currently on Racks per Story 3.2) to work consistently across Walk-Ins, Display Cases, Conventional Units, and Systems,
So that stores with multiple identical sub-equipment items don't require re-entering the same nameplate data per item (FR-NEW-10, generalised from FR7).

**Acceptance Criteria:**

**Given** an Auditor is on a Walk-In list, Display Case list, Conv Unit list, or System list,
**When** they tap "Duplicate Item N",
**Then** a new entry is created with all non-unique fields pre-filled from item N (the same field-class taxonomy as Story 3.2 — model, refrigerant, manufacturer, control type are duplicated; serial-number-like fields, photos, and quantities are not)

**Given** the source item has captured photos (Epic 14),
**When** the duplication runs,
**Then** photos are NOT copied — duplicates require their own photo capture (auditing integrity)

**Given** the Auditor duplicates an item and edits one of the pre-filled fields,
**When** they tap "Next",
**Then** the duplicated entry is saved with the edited value; the source item is unaffected (no shared-row state)

**Given** the Auditor duplicates an item from a different parent (e.g., Walk-In from Rack A while currently on Rack B),
**When** the cross-parent duplicate UX runs,
**Then** the source picker shows all walk-ins from all racks in this audit; the new walk-in is parented to the current rack, not the source's

---

## STEP 6 Self-Check Report

- [x] Every accepted gap has at least one new epic or "Additions to Epic N" block — Items 1, 2, 3 → Epics 11, 12; Item 4 → Epic 13; Item 5 → Epic 14; Items 6, 7 → Epic 15; Item 8 → Story 1.5; Item 9 → Stories 1.6, 1.7; Item 10 → Epic 16; Items 11, 12 → Stories 16.2, 16.3, 16.4; Item 13 → Story 3.7; Item 14 → Epic 17.
- [x] Every story cites at least one CSV screen number, row, or filename.
- [x] Every FR referenced exists in PRD or is listed under "Proposed New Functional Requirements" (FR-NEW-1 through FR-NEW-12).
- [x] Numbering continues from `epics.md` (last epic = 10, last stories per epic verified) — Epics 11–17, Stories 1.5–1.7, Story 3.7.
- [x] Story shape matches `epics.md` (Given/When/Then, bold markers, no bold on As a/I want/So that — matches early-epic style).
- [x] No duplicate story titles within the addendum.

---

## Menu

**Select an option:**

- **[A]** Add another module/gap (return to STEP 2 with fresh user gap list)
- **[E]** Edit a generated epic or story
- **[M]** Merge addendum into `epics.md` directly (with confirmation)
- **[D]** Done
