# Epic 3A: Machine Room

## Feature 3.1: General and Vent

### Story 3.1.1: Machine Room General

 

**As a** Field Energy Auditor,
**I want to** uniquely identify and localize the primary refrigeration machine room,
**So that** all documented racks and suction groups are tied to a specific thermal envelope for accurate baseline energy modeling.

### Acceptance Criteria

**Scenario 1: Successful identification of a standard Machine Room (Happy Path)**

- **Given** I have started a new Refrigeration audit for "Site-A",
- **When** I enter "MR-01" as the Machine Room ID and select "Main Floor" as the location,
- **And** I provide a Rack Name "Rack-A" with Suction Group "1" (Low Temp),
- **And** I tap "Next",
- **Then** the system must persist this record locally and advance me to the Ventilation screen.

**Scenario 2: Prevention of navigation due to missing mandatory data (Negative)**

- **Given** the "Machine Room ID" is empty,
- **When** I attempt to navigate to the "Next" screen,
- **Then** the application must block the navigation,
- **And** display a count of the missing required fields (e.g., "1 field requires attention").

**Scenario 3: Handling Multi-Rack Configurations (Complex Edge Case)**

- **Given** a Machine Room contains more than one refrigeration rack,
- **When** I use the "Add More" (+) function,
- **Then** the system must generate a new entry instance for "Rack Name" and "Suction Group Number",
- **And** it must link these new entries to the parent "Machine Room ID" to prevent orphaned data in the final report.

**Scenario 4: Offline Data Integrity (Technical Edge Case)**

- **Given** the device has no active internet connection in the mechanical room,
- **When** I tap "Next" after entering valid data,
- **Then** the system must save the data to a local cache and mark the record as "Pending Sync" without interrupting the audit workflow.

## Story 3.1.2: Machine Room Ventilation.1

**As a** Field Energy Auditor,
**I want to** document the mechanical and thermal control parameters of the Machine Room ventilation,
**So that** I can calculate the annual parasitic fan energy load and verify compliance with safety exhaust standards.
**Acceptance Criteria** 
**Scenario 1: Mandatory Field Validation (Negative)**
• **Given** I am on the Machine Room Ventilation screen,
• **When** I attempt to proceed to the next section without selecting a "Ventilation Type",
• **Then** the application must prevent navigation,
• **And** indicate that 1 required field remains incomplete.
**Scenario 2: Natural Ventilation Logic (Conditional Behavior)**
• **Given** I have selected "Natural" as the Ventilation Type,
• **When** the screen refreshes,
• **Then** the "Set point ON," "Set point OFF," and "Control by" fields must be disabled or hidden,
• **And** "Connected to Exhaust" should default to "No" but remain editable.
**Scenario 3: Thermal Set Point Validation (Domain Edge Case)**
• **Given** I have selected "Forced" ventilation,
• **When** I enter a "Set point OFF" temperature (e.g., $80^\circ\text{F}$) that is higher than the "Set point ON" (e.g., $75^\circ\text{F}$),
• **Then** the system must display a validation error: "OFF set point must be lower than ON set point for cooling ventilation."
**Scenario 4: Auto-Save and Navigation (Happy Path)**
• **Given** I have entered a Ventilation Type of "Forced" and a Set point ON of $75^\circ\text{F}$,
• **When** I tap "Next",
• **Then** the data must be cached locally for offline sync,
• **And** the system must navigate to the "Machine Room Exhaust" screen.

## Story 3.1.3: Machine Room Ventilation.2

**As a** Field Auditor,
**I want to** attach tagged, high-resolution visual evidence of the ventilation hardware,
**So that** the remote engineering team can verify the mechanical condition and nameplate data for energy savings calculations.

### Acceptance Criteria

**Scenario 1: Mandatory Ventilation Photo Capture (Happy Path)**

- **Given** I am documenting a "Forced" ventilation system,
- **When** I capture and save a photo for the "Picture of Ventilation" (2.103.1),
- **Then** the system must automatically tag the file with the Machine Room ID and Field ID,
- **And** the "Next" button should reflect that 0 required fields remain for this section.

**Scenario 2: Handling the "No Nameplate" Edge Case (Domain Reality)**

- **Given** I am required to take a nameplate photo, but the nameplate is missing or illegible,
- **When** I select the "Evidence Not Available" toggle and provide a "Comment" (2.103.2),
- **Then** the system should waive the photo requirement for validation,
- **And** flag this equipment for "Engineering Review" in the final report.

**Scenario 3: Validation of Intake vs. Fan (Complex Branching)**

- **Given** the Ventilation Type was previously recorded as "Natural",
- **When** the photo screen renders,
- **Then** the system should specifically prompt for a "Picture of Intake/Louver",
- **And** the "Fan Nameplate" photo requirement should be disabled.

**Scenario 4: Automatic Image Compression (Technical Performance)**

- **Given** I have captured 5 high-resolution "Add More" pictures (2.103.3),
- **When** the auto-save triggers,
- **Then** the system must compress images to a maximum of 2MB each before local storage to preserve device memory.

## Feature 3.2: Exhaust

## Story 3.2.1: Machine Room Exhaust.1

**As a** Field Energy Auditor,
**I want to** document the technical specifications and control logic of the Machine Room exhaust fans,
**So that** the mechanical energy baseline and emergency safety ventilation capacity can be verified for the final audit report.
**Acceptance Criteria (Gherkin)**
**Scenario 1: Mandatory Field Enforcement (Negative)**
• **Given** I am on the Machine Room Exhaust screen,
• **When** I attempt to proceed without selecting an "Exhaust Type",
• **Then** the application must block navigation and display a validation error message.
**Scenario 2: Natural Exhaust Logic (Functional Constraint)**
• **Given** I select "Natural" as the Exhaust Type,
• **Then** the fields for "Qty of Fans," "HP of Motor," and "Power Rating" must be disabled or hidden,
• **And** "Control By" should default to "None."
**Scenario 3: Set Point Logical Guardrail (Domain Edge Case)**
• **Given** I am entering thermostat set points for a forced exhaust fan,
• **When** I enter a "Set point OFF" (e.g., $85^\circ\text{F}$) that is equal to or higher than the "Set point ON" (e.g., $80^\circ\text{F}$),
• **Then** the system must flag a "Logical Error" and require a correction before saving.
**Scenario 4: Multi-Fan HP Aggregation (Happy Path)**
• **Given** I have identified "3" exhaust fans in the Machine Room,
• **When** I enter "1.5" into the HP field (2.104.5),
• **Then** the system should store this as "HP per unit" to allow the backend to calculate a total exhaust load of 4.5 HP.
**Scenario 5: Safety Control Identification**
• **Given** the refrigeration system uses Ammonia ($R\text{-}717$),
• **When** I select "Control by",
• **Then** "Leak Detector" must be a selectable option to verify compliance with emergency exhaust regulations.

## Story 3.2.2: Machine Room Exhaust.2

**As a** Field Energy Auditor,
**I want to** capture and tag high-quality visual evidence of the exhaust system components,
**So that** the engineering team can verify the mechanical configuration and damper integrity for the energy baseline report.

### Acceptance Criteria

**Scenario 1: Mandatory Exhaust Photo Capture (Happy Path)**

- **Given** I have completed the technical specs for "Exhaust Fan 1",
- **When** I capture a photo for "Picture of Exhaust" (2.105.1),
- **Then** the system must save the image using the naming convention `[SiteID]_[MR_ID]_Exhaust_1.jpg`,
- **And** the "Next" button should become active for navigation.

**Scenario 2: Handling Multi-Fan Requirements (Domain Logic)**

- **Given** I previously recorded "3" exhaust fans in Story 3.2.1,
- **When** I reach the Exhaust Media screen,
- **Then** the system must prompt for 3 mandatory primary photos (one for each fan unit),
- **And** prevent "Final Submission" until all 3 slots are populated.

**Scenario 3: Low-Light/Blur Detection (Edge Case)**

- **Given** I am in a dark mechanical penthouse,
- **When** I capture a photo that the system detects as significantly underexposed or blurry,
- **Then** the app should display a warning: "Image may be too dark for engineering review. Would you like to retake?"

**Scenario 4: Intentional Overwrite Protection (User Experience)**

- **Given** a primary photo has already been captured for Field 2.105.1,
- **When** I attempt to take a new photo in that same slot,
- **Then** the system must prompt: "This will replace your existing primary exhaust photo. Continue?"

## Story 3.2.3: Leak Detector

**As a** Field Auditor,
**I want to** document the operational status and technical specifications of the refrigerant leak detection system,
**So that** I can verify compliance with safety standards and ensure the facility is eligible for energy-saving retrofits without liability risks.

### Acceptance Criteria

**Scenario 1: Successful Documentation of Functional System (Happy Path)**

- **Given** I am inspecting the Machine Room for a "Halocarbon" system,
- **When** I select "Yes" for "Is it working?" and choose "Bacharach" as the Make and "MGS-450" as the Model,
- **And** I select "Solid State" as the detector type,
- **Then** the system must save the record and allow navigation to the "Photo Capture" screen.

**Scenario 2: Mandatory Reporting for Non-Functional Safety Equipment (Negative/Safety)**

- **Given** I am on the Leak Detector screen,
- **When** I select "No" for "Is it working?",
- **Then** the "Comment" field (2.106.5) must become a **Required Field**,
- **And** the system must display a high-priority warning: "Note: Non-functional leak detectors must be flagged as a safety deficiency in the final report."

**Scenario 3: Handling "Other" Manufacturers (Edge Case)**

- **Given** the leak detector is a brand not found in the "Make" dropdown (2.106.2),
- **When** I select the "Other" option,
- **Then** a text-fillable "Specify Make/Model" field must appear,
- **And** this new value must be captured for the Engineering Review team.

**Scenario 4: Attempt-First Validation (Behavioral)**

- **Given** the "Is it working?" field is empty,
- **When** I attempt to tap "Next",
- **Then** the system must prevent navigation and highlight the missing mandatory input.

## Feature 3.3: Picture

## Story 3.3.1: Picture Leak Detector

**As a** Field Auditor,
**I want to** capture and tag high-resolution photos of the leak detector's status interface,
**So that** the operational state (Power, Alarm, or Fault) can be visually verified by the engineering team for the final report.

### Acceptance Criteria

**Scenario 1: Successful Primary Photo Capture (Happy Path)**

- **Given** I am documenting a "Solid State" leak detector,
- **When** I capture the primary "Picture of Leak detector" (2.107.1),
- **Then** the image must be saved with the ID `2.107.1` appended to the project record,
- **And** the "Next" button must reflect that 0 mandatory items remain.

**Scenario 2: Prevention of Navigation (Negative Path)**

- **Given** the "Picture of Leak detector" is a mandatory requirement,
- **When** I attempt to proceed to the next screen without a captured image,
- **Then** the application must block navigation,
- **And** display a specific validation message: "A photo of the leak detector status is required to proceed."

**Scenario 3: Handling Non-Functional Equipment (Edge Case)**

- **Given** the leak detector status was previously marked as "Not Working",
- **When** I enter the Picture Leak Detector screen,
- **Then** the help text should dynamically update to: "Capture photo of the specific indicator (e.g., Alarm LED or blank display) showing the fault."

**Scenario 4: Metadata and Integrity (Domain Compliance)**

- **Given** a photo is successfully saved,
- **Then** the system must automatically embed EXIF metadata including the **Current Timestamp** and **GPS Coordinates** to ensure audit veracity.

## Story 3.3.2: Picture Machine Room

**As a** Field Energy Auditor,
**I want to** capture wide-angle visual evidence of the overall Machine Room environment,
**So that** the Engineering Lead can assess the maintenance-related energy derating factors and identify physical accessibility constraints.
**Acceptance Criteria (Gherkin)**
**Scenario 1: Successful Primary Capture (Happy Path)**
• **Given** I am at the "Picture Machine Room" audit stage,
• **When** I capture a wide-angle photo showing the room's general layout,
• **Then** the system must store the image with the metadata tag `MR_GENERAL_[ProjectID]`,
• **And** the "Next" button must enable navigation to the "Refrigeration Schedule" section.
**Scenario 2: Mandatory Evidence Check (Negative/Validation)**
• **Given** no photo has been captured for the Machine Room (2.108.1),
• **When** I attempt to proceed via the "Next" button,
• **Then** the application must prevent the screen transition,
• **And** display a status message: "Wide-angle room photo is required to assess facility condition."
**Scenario 3: Multi-Photo Flexibility (Edge Case)**
• **Given** the Machine Room is exceptionally large or has multiple distinct sections (e.g., partitioned by a firewall),
• **When** I use the "Add More" feature (2.108.3),
• **Then** each additional photo must be appended to the same Machine Room ID record without overwriting the primary photo.
**Scenario 4: Image Quality Guardrail (Domain Technical Requirement)**
• **Given** the phone's light sensor detects low ambient light ($<10\text{ lux}$),
• **When** I trigger the camera,
• **Then** the system should automatically enable the flash or prompt me to turn it on to ensure equipment visibility.

## Story 3.3.3: Picture Refrigeration Schedule

**As a** Field Energy Auditor,
**I want to** capture high-resolution visual evidence of the master Refrigeration Schedule,
**So that** the design specifications (refrigerant charge, suction groups, and design setpoints) can be cross-referenced against field findings for the energy baseline.

### Acceptance Criteria

**Scenario 1: Successful Schedule Capture (Happy Path)**

- **Given** I am in a Machine Room that has a visible Refrigeration Schedule,
- **When** I capture a photo for "Picture of the Ref Schedule" (2.109.1),
- **Then** the system must save the image with the naming convention `[RoomID]_REF_SCHED.jpg`,
- **And** allow the audit to be marked "Ready for Review."

**Scenario 2: Schedule Not Available (Domain Edge Case)**

- **Given** no physical schedule is present in the Machine Room or on the panel,
- **When** I select the "Not Available" toggle (or checkbox),
- **Then** the mandatory photo requirement (2.109.1) is waived,
- **And** the "Comment" field (2.109.2) becomes **mandatory** for the Auditor to explain how system specs will otherwise be verified.

**Scenario 3: Multi-Page Schedule Capture (Complex Behavior)**

- **Given** the schedule is a large document or spans multiple pages/panels,
- **When** I use the "Add More" feature (2.109.3),
- **Then** all subsequent photos must be grouped under the "Ref Schedule" category and sorted by capture order in the final report.

**Scenario 4: Resolution/Focus Warning (Quality Gate)**

- **Given** I am capturing high-density text on the schedule,
- **When** I trigger the shutter,
- **Then** the app should provide an overlay guide (frame) and a post-capture prompt: "Ensure all rows (HP, Design Temp) are legible. Retake if blurry?"

## Story 3.3.4: Picture Refrigeration Layout

**As a** Field Energy Auditor,
**I want to** capture a high-resolution image of the Refrigeration Layout or P&ID (Piping and Instrumentation Diagram),
**So that** the remote engineering team can verify the physical mapping of compressors, condensers, and evaporators against the documented energy baseline.

### Acceptance Criteria

**Scenario 1: Capturing a Single-Page Layout (Happy Path)**

- **Given** I am in a Machine Room with a wall-mounted system layout,
- **When** I capture a photo for "Picture of the Ref Layout" (2.110.1),
- **Then** the system must save the file using the convention `[MachineRoomID]_LAYOUT_PRIMARY.jpg`,
- **And** the "Next" button must enable navigation.

**Scenario 2: Layout is Physically Unavailable (Domain Edge Case)**

- **Given** there is no physical layout diagram available on-site,
- **When** I select the "Layout Not Available" toggle,
- **Then** the mandatory requirement for photo 2.110.1 is waived,
- **And** the "Comment" field (2.110.2) becomes **mandatory** to record where the auditor derived the system mapping.

**Scenario 3: Multi-Section Layout Capture (Complex Behavior)**

- **Given** the refrigeration layout is split across multiple drawings or a large digital screen,
- **When** I use the "Add More" feature (2.110.3) to capture overlapping sections,
- **Then** all captured images must be grouped as a single "Layout Gallery" tied to the current Machine Room record.

**Scenario 4: Verification of Data Integrity (Validation)**

- **Given** the "Layout Not Available" toggle is NOT selected,
- **When** I attempt to tap "Next" without capturing an image,
- **Then** the application must block navigation and display an error: "Evidence of system layout is required or must be marked as unavailable."

## Story 3.3.5: Picture Exhaust Fan Motor Nameplate

**As a** Field Energy Auditor,
**I want to** capture a legible photo of the exhaust fan motor nameplate,
**So that** the Engineering team can verify electrical parameters (HP, Voltage, FLA) and calculate accurate power draw for the energy baseline.

### Acceptance Criteria

**Scenario 1: Successful Nameplate Capture (Happy Path)**

- **Given** I am documenting "Exhaust Fan 01" in the Machine Room,
- **When** I capture a legible photo of the motor nameplate,
- **Then** the system must save the image using the naming convention `[RoomID]_EF01_NMPLT.jpg`,
- **And** the "Next" button must reflect that all mandatory evidence for this fan is collected.

**Scenario 2: Nameplate is Missing or Inaccessible (Domain Edge Case)**

- **Given** the motor nameplate is missing, painted over, or physically unreachable,
- **When** I select the "Nameplate Not Legible/Available" toggle,
- **Then** the mandatory requirement for photo 2.111.1 is waived,
- **And** the "Comment" field (2.111.2) must become **mandatory** to explain how the motor specs were estimated (e.g., "Matched to identical Fan #2").

**Scenario 3: Validation of Required Capture (Negative)**

- **Given** the "Nameplate Not Available" toggle is NOT selected,
- **When** I attempt to proceed to the next screen without an image in the buffer,
- **Then** the application must block navigation and display a "Missing Evidence" warning.

**Scenario 4: Verification Post-Capture (Quality Gate)**

- **Given** a photo has just been taken,
- **When** the image is previewed,
- **Then** the app must display a "Legibility Checklist" (e.g., "Can you read the HP and Voltage?") and require the user to confirm "Yes, Legible" or "Retake."

## Story 3.3.6: Picture Ventilation Fan Motor

**As a** Field Energy Auditor,
**I want to** capture a legible photo of the ventilation fan motor nameplate,
**So that** the Engineering team can verify Horsepower ($HP$), Voltage ($V$), and Efficiency ratings to calculate accurate parasitic energy consumption.
**Acceptance Criteria** 
**Scenario 1: Mandatory Photo Capture for Forced Ventilation (Happy Path)**
• **Given** the Ventilation Type was recorded as "Forced" in the previous section,
• **When** I capture a legible photo of the motor nameplate,
• **Then** the system must save the image using the naming convention `[RoomID]_VENT_NMPLT.jpg`,
• **And** the "Next" button must enable navigation.
**Scenario 2: Automatic Skip for Natural Ventilation (Logic Branching)**
• **Given** the Ventilation Type was recorded as "Natural",
• **When** I complete the Ventilation General section,
• **Then** the system must skip the "Picture Ventilation Fan Motor" screen entirely,
• **And** mark the photo requirement as "N/A" in the audit database.
**Scenario 3: Handling Inaccessible or Missing Nameplates (Edge Case)**
• **Given** the fan motor is mounted in an inaccessible location (e.g., high exterior wall),
• **When** I select the "Nameplate Inaccessible" toggle,
• **Then** the mandatory photo requirement is waived,
• **And** the "Comment" field (2.112.2) must become **mandatory** to document the reason and provide estimated motor data.
**Scenario 4: Resolution & Legibility Check (Quality Gate)**
• **Given** a nameplate photo has been captured,
• **When** the image is previewed,
• **Then** the app must prompt the user: "Is the Voltage and HP clearly visible?" and require a "Confirm" or "Retake" action.