# Epic 3B: Refrigeration Rack

## **Story 3B.1.1: Rack General**

As an Auditor, I want to record the general identification, type, age, and refrigerant details of each Rack, so that all rack-level refrigeration assets at the supermarket are uniquely identified and correctly mapped within the audit record.

**Acceptance Criteria:**

Given that an Auditor is in the Refrigeration section, when the Rack General (Rack_General) screen renders, then the following fields are displayed according to the specification:

| **Field ID** | **Field Name** | **Input Type** | **Selection Options** |
| --- | --- | --- | --- |
| 2.201.1 | Rack Name or Designation* | Dropdown menu / Fillable | Selectable from: A/B/C/D or 1/2/3/4, or fillable |
| 2.201.2 | Rack Type | Dropdown menu | Selectable from: Medium Temperature, Low Temperature, Dual Temperature |
| 2.201.3 | Rack Make | Dropdown menu | Selectable from menu |
| 2.201.4 | Rack Model / Serial Number | Fillable | Model/Serial Number is from the dataplate or from the refrigeration schedule if available |
| 2.201.5 | Age (Year of manufacturing) | Dropdown menu (Not Compulsory) | Selectable from menu: 1990 to 2026 |
| 2.201.6 | Year of last major retrofit | Dropdown menu | Selectable from menu: 1990 to 2027 |
| 2.201.7 | Comment | Fillable | Anything that is not covered. Info about retrofit if any. |
| 2.201.8 | Refrigerant | Dropdown menu | Selectable from menu |

Given that the Rack General screen is visible, when the Auditor views the fields, then each field displays the selection descriptions (e.g., "Selectable from...") as inline comments or labels for the input; no separate instruction modal or header text is present on the screen.

Given the Rack Name or Designation field, when rendered, Then it is marked with an asterisk (*) to indicate it is a required field.

Given the project specification that a supermarket may contain multiple racks, When the Auditor completes the Rack General screen for one rack, Then a control such as "Add Another Rack" is available so the entire Ref_Rack screen-set (Stories 4.1.1 through 4.7.3) can be replicated to collect data for additional racks; the screen-set must support being filled at least four (4) times by default, with the ability to add more if required.

Given the Year of manufacturing and Comment fields, when rendered, Then they are not marked as required, and the user may proceed without entering them.

Given an Auditor attempts to navigate "Next" without entering a Rack Name or Designation, When attempt-first validation runs, Then the field receives a red border and shake animation, and the "Next" button reflects the remaining required field count.

Given valid selections are made for all required fields, When the Auditor taps "Next", Then the data is auto-saved and the app navigates to the next screen in the Refrigeration hierarchy.

### **Story 3B.1.2: Rack Picture – Name Plate**

As an Auditor, I want to capture a picture of the Rack name plate, So that the make, model, refrigerant, and manufacturing date of the rack are visually verified for the audit record.

**Acceptance Criteria:**

Given an Auditor is in the Refrigeration section, When the Rack Picture.1 screen renders, Then the following fields and interactive elements are displayed according to the specification:

| **Field ID** | **Field Name** | **Input Type** | **Description / Logic** |
| --- | --- | --- | --- |
| 2.202.1 | Picture of the Rack Name Plate | Fillable | Required for initial capture. Only 1 picture will be captured; it will override the latest if taken more than once. |
|  | Sample Picture |  | Should be displayed all the time. |
| 2.202.2 | Comment | Fillable | Space to add comments if required. |
| 2.202.3 | Note (Add Picture) | "Add Picture" Button | Please add more pictures if required. |

Given the Rack Picture.1 screen renders, When the Auditor views the interface, Then the following instruction text is displayed: "Take picture of the rack name plate showing make, model, refrigerant and manufacturing date".

Given the photo capture process, When pictures are saved for this section, Then the system must follow established tagging conventions and use the IDs specified in the documentation.

Given the "Picture of the Rack Name Plate" field (2.202.1), When rendered, Then it is marked as a required field for audit completion.

Given an Auditor attempts to navigate "Next" without capturing the required name plate picture, When attempt-first validation runs, Then the field receives a red border and shake animation, and the "Next" button label updates to show the required field count.

Given valid data and the required photo are captured, When the Auditor taps "Next", Then the data and images are auto-saved and the app navigates to the next screen in the Refrigeration hierarchy.

### **Story 3B.1.3: Rack Picture – Front and Electrical Panel**

As an Auditor, I want to capture pictures of the Rack from the front and of the Rack electrical panel, So that the visible control devices, contactors, and switches are documented for the audit record.

**Acceptance Criteria:**

Given an Auditor is in the Refrigeration section, When the Rack Picture.2 screen renders, Then the following fields and interactive elements are displayed according to the specification:

| **Field ID** | **Field Name** | **Input Type** | **Description / Logic** |
| --- | --- | --- | --- |
| 2.203.1 | Picture of the rack from the front* | Fillable | Required for initial capture. |
|  | Sample Picture |  | Should be displayed all the time. |
| 2.203.2 | Picture of the Rack Electrical Panel* | Fillable | Required for initial capture. |
|  | Sample Picture |  | Should be displayed all the time. |
| 2.203.3 | Comment | Fillable | Space to add any comments if required. |
| 2.203.4 | Note (Add Picture) | "Add Picture" Button | Please add more pictures if required. |

Given the Rack Picture.2 screen renders, When the Auditor views the interface, Then the following instructions are displayed for each picture:

*Picture of the rack from the front: "Take picture of the rack from the front showing control panels and compressors, it should also show any defrost switches and notes on the front panel".*

*Picture of the Rack Electrical Panel: "Take picture of the electrical panel from inside showing contactors of each compressor, wire labelling, defrost controller, DPDT switch (for VFD), Phase Monitor, etc.".*

Given the photo capture process, When a picture is saved, Then the system follows the established convention for tagging pictures and IDs as specified in the project documentation.

Given the "Picture of the rack from the front" field (2.203.1) and the "Picture of the Rack Electrical Panel" field (2.203.2), When rendered, Then both are marked with an asterisk (*) to indicate they are required fields.

Given an Auditor attempts to navigate "Next" without capturing both required pictures, When attempt-first validation runs, Then each missing field receives a red border and shake animation, and the "Next" button label updates to show the required field count.

Given valid data and the required photos are captured, When the Auditor taps "Next", Then the data and images are auto-saved and the app navigates to the next screen in the Refrigeration hierarchy.

### **Story 3B.1.4: Rack Picture – Back**

As an Auditor, I want to capture a picture of the Rack from the back, So that the compressors, headers, EPRs, receiver, and other valves are documented for the audit record.

**Acceptance Criteria:**

Given an Auditor is in the Refrigeration section, When the Rack Picture.3 screen renders, Then the following fields and interactive elements are displayed according to the specification:

| **Field ID** | **Field Name** | **Input Type** | **Description / Logic** |
| --- | --- | --- | --- |
| 2.204.1 | Picture of the rack from the back* | Fillable | Required for initial capture. |
|  | Sample Picture |  | Should be displayed all the time. |
| 2.204.2 | Comment | Fillable | Space to add any comments if required. |
| 2.204.3 | Note (Add Picture) | "Add Picture" Button | Please add more pictures if required. |

Given the Rack Picture.3 screen renders, When the Auditor views the interface, Then the following instruction text is displayed: "Take picture of the rack from the back showing Compressors, headers, EPRs, Receiver and other valves".

Given the "Picture of the rack from the back" field (2.204.1), When rendered, Then it is marked with an asterisk (*) to indicate it is a required field.

Given an Auditor attempts to navigate "Next" without capturing the required picture, When attempt-first validation runs, Then the field receives a red border and shake animation.

Given valid data and the required photo are captured, When the Auditor taps "Next", Then the data and images are auto-saved and the app navigates to the next screen in the Refrigeration hierarchy.

## **Feature 3B.2: Pipe Headers**

### **Story 3B.2.1: Suction Header**

As an Auditor, I want to capture a picture of the Suction Header and record its size, So that the state of insulation on the header and the suction filter, plus the pipe sizing, are documented for the audit record.

**Acceptance Criteria:**

Given an Auditor is in the Refrigeration section, When the Picture_Suction Header screen renders, Then the following fields and interactive elements are displayed according to the specification:

| **Field ID** | **Field Name** | **Input Type** | **Description / Logic** |
| --- | --- | --- | --- |
| 2.205.1 | Picture of Suction header | Fillable | Add: Instructions to show exact location of size. |
|  | Sample Picture |  | Should be displayed all the time. |
| 2.205.2 | Comment | Fillable | Space to add any comments if required. |
| 2.205.3 | Size of the header (Measurement) | Dropdown menu | Selectable from pipe sizes. |
| 2.205.4 | Note (Add Picture) | "Add Picture" Button | Please add more pictures if required. |

Given the Picture_Suction Header screen renders, When the Auditor views the interface, Then the following instruction text is displayed: "Take picture of the suction header showing state of insulation on header and on the suction filter of compressors".

Given the screen contains a Measurement sub-section, When the Auditor views the screen, Then the "Size of the header" field is rendered under a clearly labelled "Measurement" sub-block to distinguish it from picture-only inputs.

Given the "Picture of Suction header" field (2.205.1) is captured, When the Auditor taps "Next", Then the data and image are auto-saved and the app navigates to the next screen in the Refrigeration hierarchy.

### **Story 3B.2.2: Discharge Header**

As an Auditor, I want to capture a picture of the Discharge Header and record its size, So that the discharge piping configuration of the rack is documented for the audit record.

**Acceptance Criteria:**

Given an Auditor is in the Refrigeration section, When the Picture_Discharge Header screen renders, Then the following fields and interactive elements are displayed according to the specification:

| **Field ID** | **Field Name** | **Input Type** | **Description / Logic** |
| --- | --- | --- | --- |
| 2.206.1 | Picture of Discharge header | Fillable | Add: Instructions to show exact location of size. |
|  | Sample Picture |  | Should be displayed all the time. |
| 2.206.2 | Comment | Fillable | Space to add any comments if required. |
| 2.206.3 | Size of the header (Measurement) | Dropdown menu | Selectable from pipe sizes. |
| 2.206.4 | Note (Add Picture) | "Add Picture" Button | Please add more pictures if required. |

Given the Picture_Discharge Header screen renders, When the Auditor views the interface, Then the following instruction text is displayed: "Take picture of the Discharge header".

Given the screen contains a Measurement sub-section, When the Auditor views the screen, Then the "Size of the header" field is rendered under a clearly labelled "Measurement" sub-block.

Given the picture and (optional) size are captured, When the Auditor taps "Next", Then the data and image are auto-saved and the app navigates to the next screen in the Refrigeration hierarchy.

### **Story 3B.2.3: Liquid Line Header**

As an Auditor, I want to capture a picture of the Liquid Line Header and record its size, So that the state of insulation on the liquid line header and the pipe sizing are documented for the audit record.

**Acceptance Criteria:**

Given an Auditor is in the Refrigeration section, When the Picture_Liquid Line Header screen renders, Then the following fields and interactive elements are displayed according to the specification:

| **Field ID** | **Field Name** | **Input Type** | **Description / Logic** |
| --- | --- | --- | --- |
| 2.207.1 | Picture of Liquid Line header | Fillable | Add: Instructions to show exact location of size. |
|  | Sample Picture |  | Should be displayed all the time. |
| 2.207.2 | Comment | Fillable | Space to add any comments if required. |
| 2.207.3 | Size of the header (Measurement) | Dropdown menu | Selectable from pipe sizes. |
| 2.207.4 | Note (Add Picture) | "Add Picture" Button | Please add more pictures if required. |

Given the Picture_Liquid Line Header screen renders, When the Auditor views the interface, Then the following instruction text is displayed: "Take picture of the Liquid Line header showing state of insulation on header".

Given the screen contains a Measurement sub-section, When the Auditor views the screen, Then the "Size of the header" field is rendered under a clearly labelled "Measurement" sub-block.

Given the picture and size are captured, When the Auditor taps "Next", Then the data and image are auto-saved and the app navigates to the next screen in the Refrigeration hierarchy.

## **Feature 3B.3: Oil Management**

### **Story 3B.3.1: Oil Management System**

As an Auditor, I want to record the type, make, model, level, and condition of the Oil Management System (separator and reservoir), So that the lubrication system of the rack is accurately documented for the audit record.

**Acceptance Criteria:**

Given an Auditor is in the Refrigeration section, When the Oil Management System screen renders, Then the following fields are displayed according to the specification:

| **Field ID** | **Field Name** | **Input Type** | **Selection Options / Descriptions** |
| --- | --- | --- | --- |
| 2.208.1 | Type of oil separator | Dropdown menu | Selectable from: Coalescent / Helical / Other |
| 2.208.2 | Make of oil separator | Dropdown menu / Fillable | Selectable from menu |
| 2.208.3 | Model of oil separator | Fillable | Selectable from a menu |
| 2.208.4 | Make of oil reservoir, if any | Dropdown menu / Fillable | Selectable from menu |
| 2.208.5 | Model of oil reservoir, if any | Fillable | Selectable from a menu |
| 2.208.6 | Level of oil in the reservoir / separator | Dropdown menu | Selectable from: Low / Medium / High. Check from the site glass on reservoir or separator. |
| 2.208.7 | Oil Type | Dropdown menu | Selectable from: Mineral / Synthetic / POE / Other. If R22 then Mineral oil otherwise POE. |
| 2.208.8 | Any oil leaks | Dropdown menu | Selectable from: Yes / No. Prominent oil leaks should be mentioned. |

Given the Oil Management System screen renders, When the Auditor views the fields, Then each field displays its specific selection options or descriptions as inline comments or labels.

Given the Type of oil separator and Level of oil fields, When rendered, Then their help descriptions guide the Auditor on where to read each value (e.g., "Check from the site glass on reservoir or separator").

Given valid data is entered for the fields, When the Auditor taps "Next", Then the data is auto-saved and the app navigates to the next screen in the Refrigeration hierarchy.

### **Story 3B.3.2: Picture – Oil Management System**

As an Auditor, I want to capture pictures of the Oil Separator/Reservoir and the Oil Level, So that the visual condition of the lubrication components and oil charge are documented for verification.

**Acceptance Criteria:**

Given an Auditor is in the Refrigeration section, When the Picture_Oil Management System screen renders, Then the following fields and interactive elements are displayed according to the specification:

| **Field ID** | **Field Name** | **Input Type** | **Description / Logic** |
| --- | --- | --- | --- |
| 2.209.1 | Picture of Oil Separator and Reservoir* | Fillable | Required for initial capture. |
|  | Sample Picture |  | Should be displayed all the time. |
| 2.209.2 | Picture of Oil Level in the Separator/Reservoir* | Fillable | Required for initial capture. |
|  | Sample Picture |  | Should be displayed all the time. |
| 2.209.3 | Comment | Fillable | Space to add any comments if required. |
| 2.209.4 | Note (Add Picture) | "Add Picture" Button | Please add more pictures if required. |

Given the Picture_Oil Management System screen renders, When the Auditor views the interface, Then the following instructions are displayed for each required picture:

*Picture of Oil Separator and Reservoir: "Take picture of the oil separator and reservoir with full view, preferably showing the make and model".*

*Picture of Oil Level in the Separator/Reservoir: "Take picture of the oil level in the oil separator/reservoir with full view".*

Given fields 2.209.1 and 2.209.2 are both marked with an asterisk (*), When rendered, Then both are required for audit completion.

Given an Auditor attempts to navigate "Next" without both required pictures, When attempt-first validation runs, Then each missing field receives a red border and shake animation, and the "Next" button label updates to show the required field count.

Given valid data and the required photos are captured, When the Auditor taps "Next", Then the data and images are auto-saved and the app navigates to the next screen in the Refrigeration hierarchy.

## **Feature 3B.4: Receiver**

### **Story 3B.4.1: Receiver**

As an Auditor, I want to record the make, model, orientation, level, and pressure-drop measurements of the Receiver, So that the high-side liquid storage and filtration components of the rack are accurately documented for the audit record.

**Acceptance Criteria:**

Given an Auditor is in the Refrigeration section, When the Receiver screen renders, Then the following fields are displayed according to the specification:

| **Field ID** | **Field Name** | **Input Type** | **Selection Options / Descriptions** | **Unit** |
| --- | --- | --- | --- | --- |
| 2.210.1 | Make of Receiver | Dropdown menu / Fillable | Selectable from menu |  |
| 2.210.2 | Model / CRN of Receiver | Fillable |  |  |
| 2.210.3 | Receiver Orientation | Dropdown menu | Selectable from: Horizontal / Vertical |  |
| 2.210.4 | Liquid level in the receiver | Dropdown menu | Selectable from: Low / Medium / High. Check from the site glass or gauge mounted on the receiver. |  |
| 2.210.5 | Level gauge type | Dropdown menu | Selectable from: Analog / Digital / Sight glass |  |
| 2.210.6 | Type of receiver | Dropdown menu | Selectable from: Surge / Standard / Other |  |
| 2.210.7 | MMYY of change of liquid line filter | Fillable | Filter change date is written on the filter or ask maintenance. |  |
| 2.210.8 | Actual pressure drop across LL filter (PSI)* (Measurement) | Fillable | Measured value of PSI across the filter. Actual pressure drop is to be measured from a calibrated gauge. | PSIG |
| 2.210.9 | Hold back valve setting (PSI) | Fillable | Enter, if it is indicated otherwise N.A. In many cases, the setting is written on the hold back valve or is tagged. | PSIG |

Given the screen contains a Measurement sub-section, When the Auditor views the screen, Then field 2.210.8 "Actual pressure drop across LL filter (PSI)*" is rendered under a clearly labelled "Measurement" sub-block to distinguish it from descriptive inputs.

Given the "Actual pressure drop across LL filter (PSI)" field (2.210.8), When rendered, Then it is marked with an asterisk (*) to indicate it is a required field.

Given an Auditor attempts to navigate "Next" without entering the actual pressure drop, When attempt-first validation runs, Then the field receives a red border and shake animation, and the "Next" button reflects the remaining required field count.

Given valid data is entered for the required field(s), When the Auditor taps "Next", Then the data is auto-saved and the app navigates to the next screen in the Refrigeration hierarchy.

### **Story 3B.4.2: Picture – Receiver**

As an Auditor, I want to capture pictures of the Receiver, its data plate, the liquid level from both the gauge and the controller, and the Liquid Line Filter, So that the receiver configuration and operating state are fully documented for verification.

**Acceptance Criteria:**

Given an Auditor is in the Refrigeration section, When the Picture_Receiver screen renders, Then the following fields and interactive elements are displayed according to the specification:

| **Field ID** | **Field Name** | **Input Type** | **Description / Logic** |
| --- | --- | --- | --- |
| 2.211.1 | Picture of Receiver* | Fillable | Required for initial capture. |
|  | Sample Picture |  | Should be displayed all the time. |
| 2.211.2 | Picture of Receiver Data Plate* | Fillable | Required for initial capture. |
|  | Sample Picture |  | Should be displayed all the time. |
| 2.211.3 | Picture of Liquid Level from Gauge* | Fillable | Required for initial capture. |
|  | Sample Picture |  | Should be displayed all the time. |
| 2.211.4 | Picture of Liquid Level from Controller* | Fillable | Required for initial capture. |
|  | Sample Picture |  | Should be displayed all the time. |
| 2.211.5 | Picture of Liquid Line Filter* | Fillable | Required for initial capture. |
|  | Sample Picture |  | Should be displayed all the time. |
| 2.211.6 | Comment | Fillable | Space to add any comments if required. |
| 2.211.7 | Note (Add Picture) | "Add Picture" Button | Please add more pictures if required. |

Given the Picture_Receiver screen renders, When the Auditor views the interface, Then the following instructions are displayed for each required picture:

*Picture of Receiver: "Take picture of the receiver with full view".*

*Picture of Receiver Data Plate: "Take picture of the receiver data plate showing make and model/CRN # and year".*

*Picture of Liquid Level from Gauge: "Take picture of the level gauge showing the liquid level in the receiver".*

*Picture of Liquid Level from Controller: "Take picture of the receiver liquid level from the controller. Note if the level here is different than actual level in the receiver".*

*Picture of Liquid Line Filter: "Take picture of the liquid line filter with full view".*

Given each of fields 2.211.1 through 2.211.5 is marked with an asterisk (*), When rendered, Then all five pictures are required for audit completion.

Given an Auditor attempts to navigate "Next" without capturing any of the required pictures, When attempt-first validation runs, Then each missing field receives a red border and shake animation, and the "Next" button label updates to show the required field count.

Given valid data and the required photos are captured, When the Auditor taps "Next", Then the data and images are auto-saved and the app navigates to the next screen in the Refrigeration hierarchy.

## **Feature 3B.5: Defrost Differential Pressure Regulating Valve**

### **Story 3B.5.1: Defrost Differential Pressure Regulating Valve**

As an Auditor, I want to record the make, model, and pressure setting of the Defrost Differential Pressure Regulating Valve, So that the defrost pressure-control device is accurately documented for the audit record.

**Acceptance Criteria:**

Given an Auditor is in the Refrigeration section, When the Defrost Differential Pressure Regulating Valve screen renders, Then the following fields are displayed according to the specification:

| **Field ID** | **Field Name** | **Input Type** | **Selection Options / Descriptions** | **Unit** |
| --- | --- | --- | --- | --- |
| 2.212.1 | Make of the valve | Dropdown menu / Fillable | Selectable from: Parker Hannifin, Danfoss, Other |  |
| 2.212.2 | Model of the valve | Fillable |  |  |
| 2.212.3 | Valve setting (PSI) | Fillable | Enter, if it is indicated otherwise N.A. In many cases, the setting is written on the valve or is tagged. If not, ask maintenance. | PSIG |

Given the screen renders, When the Auditor views the fields, Then each field displays its specific selection options or descriptions as inline comments or labels.

Given valid data is entered for the fields, When the Auditor taps "Next", Then the data is auto-saved and the app navigates to the next screen in the Refrigeration hierarchy.

### **Story 3B.5.2: Picture – Defrost Differential Pressure Regulating Valve**

As an Auditor, I want to capture a picture of the Defrost Differential Pressure Regulating Valve, So that its make, model, and physical condition are documented for verification.

**Acceptance Criteria:**

Given an Auditor is in the Refrigeration section, When the Picture_Defrost Differential Pressure Regulating Valve screen renders, Then the following fields and interactive elements are displayed according to the specification:

| **Field ID** | **Field Name** | **Input Type** | **Description / Logic** |
| --- | --- | --- | --- |
| 2.213.1 | Picture of Defrost Differential Pressure Regulating Valve* | Fillable | Required for initial capture. |
|  | Sample Picture |  | Should be displayed all the time. |
| 2.213.2 | Comment | Fillable | Space to add any comments if required. |
| 2.213.3 | Note (Add Picture) | "Add Picture" Button | Please add more pictures if required. |

Given the screen renders, When the Auditor views the interface, Then the following instruction text is displayed: "Take picture of the Defrost Differential Valve with full view, preferably showing the make and model".

Given the "Picture of Defrost Differential Pressure Regulating Valve" field (2.213.1), When rendered, Then it is marked with an asterisk (*) to indicate it is a required field.

Given an Auditor attempts to navigate "Next" without capturing the required picture, When attempt-first validation runs, Then the field receives a red border and shake animation, and the "Next" button label updates to show the required field count.

Given valid data and the required photo are captured, When the Auditor taps "Next", Then the data and image are auto-saved and the app navigates to the next screen in the Refrigeration hierarchy.

## **Feature 3B.6: Subcooler**

### **Story 3B.6.1: Subcooler**

As an Auditor, I want to record the make, model, set points, line sizes, degree of subcooling, and controller programming for the Subcooler, So that liquid-line subcooling performance and controls are accurately documented for the audit record.

**Acceptance Criteria:**

Given an Auditor is in the Refrigeration section, When the Subcooler screen renders, Then the following fields are displayed according to the specification:

| **Field ID** | **Field Name** | **Input Type** | **Selection Options / Descriptions** | **Unit** |
| --- | --- | --- | --- | --- |
| 2.214.1 | Make of the subcooler | Dropdown menu / Fillable | Enter the manufacturer of subcooler. |  |
| 2.214.2 | Model of the subcooler | Dropdown menu / Fillable | Model number should be taken from the data plate. |  |
| 2.214.3 | Set point (Off) (°F) | Dropdown menu | Selectable from a menu range 45–100. Temperature of the liquid, below which the subcooler turns off (a.k.a. minimum temperature of the liquid). | F |
| 2.214.4 | Set point (On) (°F) | Dropdown menu | Selectable from a menu. This is the upper limit of the deadband; above this temperature, the subcooler comes off. | F |
| 2.214.5 | Subcooler inlet size | Dropdown menu | Selectable from: 3/8", 1/2", 5/8", 7/8", 1", 1-3/8", 1-5/8", 1-7/8", 2-1/8". Connected to the liquid line coming from receiver. | Inch |
| 2.214.6 | Subcooler outlet size | Dropdown menu | Selectable from: 3/8", 1/2", 5/8", 7/8", 1", 1-3/8", 1-5/8", 1-7/8", 2-1/8". Connected to the liquid line header. | Inch |
| 2.214.7 | Degree of subcooling | Dropdown menu | Should be mentioned in the controller. If not, use liquid-out temperature from subcooler minus saturated condensing temperature. | F |
| 2.214.8 | Programmed in controller | Dropdown menu | Selectable from: Yes / No. Check if the control parameters for subcooler are programmed in the controller. |  |
| 2.214.9 | Comments | Fillable | Anything that is not covered above and is important to mention. |  |

Given the Subcooler screen renders, When the Auditor views the fields, Then each field displays its specific selection options, ranges, and operational descriptions as inline comments or labels.

Given valid data is entered for the fields, When the Auditor taps "Next", Then the data is auto-saved and the app navigates to the next screen in the Refrigeration hierarchy.

### **Story 3B.6.2: Picture – Subcooler**

As an Auditor, I want to capture a picture of the Subcooler data plate (or the overall unit if the data plate is not visible), So that the subcooler identification and connection to the liquid line are documented.

**Acceptance Criteria:**

Given an Auditor is in the Refrigeration section, When the Picture_Subcooler screen renders, Then the following fields and interactive elements are displayed according to the specification:

| **Field ID** | **Field Name** | **Input Type** | **Description / Logic** |
| --- | --- | --- | --- |
| 2.215.1 | Picture of Subcooler dataplate | Fillable | Capture the subcooler dataplate. |
|  | Sample Picture |  | Should be displayed all the time. |
| 2.215.2 | Comment | Fillable | Space to add any comments if required. |
| 2.215.3 | Note (Add Picture) | "Add Picture" Button | Take additional pictures as required. |

Given the Picture_Subcooler screen renders, When the Auditor views the interface, Then the following instruction text is displayed: "Take picture of the subcooler data plate if visible. If not then take the picture of the overall subcooler. Show connection to the liquid line if possible".

Given the picture is captured, When the Auditor taps "Next", Then the data and image are auto-saved and the app navigates to the next screen in the Refrigeration hierarchy.

### **Story 3B.6.3: Picture – Subcooler Controls**

As an Auditor, I want to capture a picture of the Subcooler control logic from the controller, So that the configured set points and live operating conditions are documented for verification.

**Acceptance Criteria:**

Given an Auditor is in the Refrigeration section, When the Picture_Subcooler Controls screen renders, Then the following fields and interactive elements are displayed according to the specification:

| **Field ID** | **Field Name** | **Input Type** | **Description / Logic** |
| --- | --- | --- | --- |
| 2.216.1 | Picture of Subcooler control logic | Fillable | Capture controller screen with set points and live operating values. |
|  | Sample Picture |  | Should be displayed all the time. |
| 2.216.2 | Comment | Fillable | Space to add any comments if required. |
| 2.216.3 | Note (Add Picture) | "Add Picture" Button | Take additional pictures as required. |

Given the screen renders, When the Auditor views the interface, Then the following instruction text is displayed: "Take picture of the subcooler control set points showing control logic including on/off set points and actual operating conditions".

Given the picture is captured, When the Auditor taps "Next", Then the data and image are auto-saved and the app navigates to the next screen in the Refrigeration hierarchy.

## **Feature 3B.7: Heat Reclaim**

### **Story 3B.7.1: Heat Reclaim**

As an Auditor, I want to record the type, capacity, valve identification, pipe sizes, set points, controller programming, and connected unit for the Heat Reclaim system, So that any free-heating contribution to space heating or water heating is accurately documented for the audit record.

**Acceptance Criteria:**

Given an Auditor is in the Refrigeration section, When the Heat Reclaim screen renders, Then the following fields are displayed according to the specification:

| **Field ID** | **Field Name** | **Input Type** | **Selection Options / Descriptions** | **Unit** |
| --- | --- | --- | --- | --- |
| 2.217.1 | Type | Dropdown menu | Selectable from: Air / Water. Air-side heat reclaim feeds a coil in an HVAC unit; water-side feeds tanks for water heating. |  |
| 2.217.2 | Is it working? | Dropdown menu | Selectable from: Yes / No. Check if it is still connected and operating to provide free heating. |  |
| 2.217.3 | Capacity (of water if applicable) | Dropdown menu | Capacity in MBTU or MBH. In case of water heat, see the capacity on the tanks. | MBH |
| 2.217.4 | Heat Reclaim Valve Make | Fillable |  |  |
| 2.217.5 | Heat Reclaim Valve Model | Fillable |  |  |
| 2.217.6 | Pipe size supply | Dropdown menu | Selectable from: 3/8", 1/2", 5/8", 7/8", 1", 1-3/8", 1-5/8", 1-7/8", 2-1/8". Pipe going into the heat exchanger from discharge line. | Inch |
| 2.217.7 | Pipe size return | Dropdown menu | Selectable from: 3/8", 1/2", 5/8", 7/8", 1", 1-3/8", 1-5/8", 1-7/8", 2-1/8". Pipe coming out of the heat-reclaim heat exchanger going to condenser. | Inch |
| 2.217.8 | Set point ON (°F) | Dropdown menu | Selectable from menu. The set point at which the control valve opens and feeds hot gas to the heat exchanger or coil. | F |
| 2.217.9 | Set point Off (°F) | Dropdown menu | Selectable from menu. The set point at which the control valve closes and stops hot gas to the heat exchanger or coil. | F |
| 2.217.10 | Programmed in controller | Dropdown menu | Selectable from: Yes / No. Confirm if the controls are programmed in the controller. |  |
| 2.217.11 | Connected unit # if air side | Dropdown menu | Selectable from menu. For air-side heat reclaim, mention the connected RTU/AHU unit number. |  |
| 2.217.12 | Comments | Fillable |  |  |

Given the Heat Reclaim screen renders, When the Auditor views the fields, Then each field displays its specific selection options or descriptions as inline comments or labels.

Given the "Type" field selection (Air vs. Water), When the Auditor selects "Air", Then the field "Connected unit # if air side" (2.217.11) becomes prominently displayed/required to capture the linked RTU/AHU; when "Water" is selected, that field may be hidden or marked Not Applicable.

Given valid data is entered for the fields, When the Auditor taps "Next", Then the data is auto-saved and the app navigates to the next screen in the Refrigeration hierarchy.

### **Story 3B.7.2: Picture – Heat Reclaim**

As an Auditor, I want to capture a picture of the Heat Reclaim valve and connections, So that the valve make/model and pipe configuration are documented for verification.

**Acceptance Criteria:**

Given an Auditor is in the Refrigeration section, When the Picture_Heat Reclaim screen renders, Then the following fields and interactive elements are displayed according to the specification:

| **Field ID** | **Field Name** | **Input Type** | **Description / Logic** |
| --- | --- | --- | --- |
| 2.218.1 | Picture of Heat Reclaim | Fillable | Capture valve, make/model, and connection sizes. |
|  | Sample Picture |  | Should be displayed all the time. |
| 2.218.2 | Comment | Fillable | Space to add any comments if required. |
| 2.218.3 | Note (Add Picture) | "Add Picture" Button | Take additional pictures as required. |

Given the screen renders, When the Auditor views the interface, Then the following instruction text is displayed: "Take picture of the heat reclaim system showing the valve, its make and model # and connection sizes".

Given the picture is captured, When the Auditor taps "Next", Then the data and image are auto-saved and the app navigates to the next screen in the Refrigeration hierarchy.

### **Story 3B.7.3: Picture – Heat Reclaim Controls**

As an Auditor, I want to capture a picture of the Heat Reclaim control logic from the controller, So that the set points and live operating conditions are documented for verification.

**Acceptance Criteria:**

Given an Auditor is in the Refrigeration section, When the Picture_Heat Reclaim Controls screen renders, Then the following fields and interactive elements are displayed according to the specification:

| **Field ID** | **Field Name** | **Input Type** | **Description / Logic** |
| --- | --- | --- | --- |
| 2.219.1 | Picture of Heat Reclaim Control | Fillable | Capture controller screen with set points and live operating values. |
|  | Sample Picture |  | Should be displayed all the time. |
| 2.219.2 | Comment | Fillable | Space to add any comments if required. |
| 2.219.3 | Note (Add Picture) | "Add Picture" Button | Take additional pictures as required. |

Given the screen renders, When the Auditor views the interface, Then the following instruction text is displayed: "Take picture of the heat reclaim control set points showing control logic including on/off set points and actual operating conditions".

Given the picture is captured, When the Auditor taps "Next", Then the data and image are auto-saved and the app navigates to the next screen in the Refrigeration hierarchy. As this is the final screen of the Rack screen-set, the Auditor is also presented with controls to either add another rack (replicating Stories 4.1.1–4.7.3) or proceed to the next Epic in the audit flow.