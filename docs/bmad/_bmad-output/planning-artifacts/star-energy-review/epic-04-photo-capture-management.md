## Epic 4: Photo Capture & Management

Auditor can capture equipment photos within the audit workflow using the device camera, auto-tagged to the current equipment and section, with upload status tracking and a file input fallback when camera permission is denied.

**FRs covered:** FR11, FR12, FR13, FR14, FR15, FR29

---

### Story 4.1: Camera Capture & PhotoCaptureField Component

As an Auditor,
I want to capture a photo from within the audit screen using my device's rear camera,
So that equipment photos are taken without switching to my camera app and losing my place in the audit.

**Acceptance Criteria:**

**Given** an Auditor reaches a screen requiring a photo,
**When** the PhotoCaptureField component renders in "empty" state,
**Then** a dashed-border capture area is shown with a camera icon CTA; `aria-label="Capture [photo type] photo"` is set

**Given** an Auditor taps the capture area,
**When** `navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })` is called,
**Then** the device's rear camera opens for capture

**Given** camera permission is denied or unsupported,
**When** the MediaDevices API call fails,
**Then** the component falls back to `<input type="file" accept="image/*" capture="environment">` — audit screen remains fully functional

**Given** the Auditor captures a photo,
**When** the image is returned from the camera,
**Then** the PhotoCaptureField transitions to "uploading" state showing a progress indicator; the capture button meets `min-h-[48px] min-w-[48px]` (NFR-A1)

**Given** the photo framing instructions screen is shown before capture,
**When** the Auditor views it (FR12),
**Then** the required framing description and a sample reference image are displayed; the Auditor taps "I'm ready" to proceed to the camera

---

### Story 4.2: Auto-Tagging & Azure Blob Upload

As an Auditor,
I want each photo automatically tagged to the equipment I'm currently documenting,
So that photos never need manual re-association and the audit trail is complete at the point of capture.

**Acceptance Criteria:**

**Given** an Auditor captures a photo on a Compressor screen,
**When** the upload begins,
**Then** POST `/api/v1/photos` is called with `auditId`, `sectionId`, `equipmentId`, `equipmentType`, and `photoType` extracted from the current route context — no manual input required (FR13)

**Given** the photo is uploaded to Azure Blob Storage,
**When** the API stores the photo metadata,
**Then** the photo record includes structured alt text from `generatePhotoAltText(equipmentType, equipmentId, photoType, sectionContext)` — e.g., "Compressor nameplate photo — Refrigeration › Rack 2 › Compressor 1, ID COMP-1042-R2C1"

**Given** the photo upload completes successfully,
**When** the PhotoCaptureField receives the success response,
**Then** the component transitions to "uploaded" state showing the photo thumbnail with the auto-tag label beneath it

**Given** the photo upload fails (network error),
**When** the PhotoCaptureField receives the error,
**Then** the component shows "Upload failed — tap to retry" in red; automatic retry is attempted up to 3 times before surfacing permanent failure (NFR-R4)

**Given** an audit transitions to IN_REVIEW state,
**When** the photo-lifecycle service runs (FR29),
**Then** all photos for that audit are locked in Azure Blob — further uploads to that audit are rejected with 409 Conflict

---

### Story 4.3: Additional Photos & Photo Comments

As an Auditor,
I want to add extra photos beyond the required minimum and attach text comments to any photo,
So that unusual equipment conditions or clarifying context can be documented without blocking the audit flow.

**Acceptance Criteria:**

**Given** the required photo for a screen has been captured,
**When** the PhotoCaptureField renders in "uploaded" state,
**Then** an "Add another photo" secondary button is visible; tapping it opens the camera for an additional capture (FR14)

**Given** an Auditor taps the comment icon on a photo thumbnail,
**When** a text input appears,
**Then** typing and tapping "Save" calls PATCH `/api/v1/photos/:photoId` with the comment text (FR15); the comment persists on re-render

**Given** an Auditor adds 3 or more photos to a single screen,
**When** the photo grid renders,
**Then** thumbnails display in a scrollable grid without overflowing the viewport; each additional (non-required) photo has a delete option

---

### Story 4.4: Upload Queue, Retry & Status Visibility

As an Auditor,
I want to see the upload status of every photo and have failed uploads retry automatically,
So that I'm never surprised by a missing photo at submission and don't have to manage re-uploads manually.

**Acceptance Criteria:**

**Given** multiple photos are uploading simultaneously,
**When** the `usePhotoUploadStore` Zustand store tracks the queue,
**Then** each photo shows its status independently: queued / uploading (progress) / uploaded (✓) / failed (retry)

**Given** a photo upload fails due to a connectivity drop,
**When** connectivity is restored,
**Then** the failed photo is automatically re-queued and retried; the Auditor sees the status update without manual action (NFR-R4)

**Given** a photo upload permanently fails after 3 automatic retries,
**When** the final retry fails,
**Then** the photo status shows "Upload failed — tap to retry manually" in persistent red

**Given** an Auditor reaches the Review & Submit screen,
**When** any required photo has not uploaded successfully,
**Then** the Submit button remains disabled and a message identifies which screens have pending photo uploads; submission is only enabled when all required photos are confirmed uploaded

---

