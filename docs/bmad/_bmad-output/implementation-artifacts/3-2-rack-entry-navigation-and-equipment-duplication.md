# Story 3.2: Rack Entry, Navigation & Equipment Duplication

Status: review

## Story

As a Field Energy Auditor,
I want to document the Machine Room Exhaust system, then create and navigate multiple rack entries — including duplicating a rack to pre-fill similar data —
so that I can efficiently capture all rack-level refrigeration assets for a store with multiple identical racks without re-entering common nameplate data.

**Source:** `epic-03-refrigeration-data-collection-core-audit-engine.md` Story 3.2 ACs; `Epic 3A Machine Room` Stories 3.2.1 (Exhaust); `Epic 3B Refrigeration Rack` Story 3B.1.1 (Rack General). Covers FR3, FR4, FR7, FR8.

**Scope — what this story ships:**
- Machine Room Exhaust screen (`/audit/:auditId/section/refrigeration/exhaust`) — extends machine room data with `data.exhaust` sub-key; completes the stub URL left by Story 3.1 AC10.
- Rack entity API (`POST /GET /PATCH /api/v1/audits/:auditId/machine-rooms/:roomId/racks[/:rackId]` + duplicate endpoint). The `Rack` table already exists in the Prisma schema — **no new migration needed**.
- Rack List screen (`/audit/:auditId/section/refrigeration/racks`) — shows all racks with completion status, "Add Rack" button, "Duplicate" button.
- Rack General screen (`/audit/:auditId/section/refrigeration/rack/:rackId/general`) — full 3B.1.1 data entry (Rack Name*, Rack Type, Make, Model/Serial, Age, Last Retrofit, Refrigerant, Comment).
- Equipment duplication: `POST …/racks/:rackId/duplicate` + "Duplicate" UI on Rack List.
- App.tsx routing update for `/exhaust`, `/racks`, `/rack/:rackId/general`.

**Out of scope (deferred):**
- Photo screens (3B.1.2 Rack Name Plate, 3B.1.3 Front/Electrical, 3B.1.4 Back) → **Epic 4** (Photo Capture infrastructure not yet built).
- Machine Room Leak Detector (3A.3.2.3 / screens 2.106–2.107) → **Story 3.3** (groups with compressor data).
- Machine Room photos (3A.3.3.2–3.3.4 screens 2.108–2.110) → **Epic 4**.
- Pipe Headers, Oil Management, Receiver, Valve, Subcooler, Heat Reclaim → **Story 3.3/3.4** (Rack sub-screen flow).
- Compressors → **Story 3.3**.
- Condensers / Walk-Ins / Display Cases → **Story 3.4**.

## Acceptance Criteria

1. **AC1 — Machine Room Exhaust fields.** The Exhaust screen at `/audit/:auditId/section/refrigeration/exhaust` renders:
   - **Exhaust Type\*** (required, Forced | Natural) — red border + shake + "N required field(s) remaining" on empty Next tap.
   - **Qty of Fans** (dropdown 1–6), **HP of Motor** (numeric), **Power Rating (W)** (numeric), **Set point ON (°F)** (numeric), **Set point OFF (°F)** (numeric), **Control by** (Thermostat | Timer | VFD | Leak Detector | None) — visible only when Exhaust Type = "Forced".
   - **Comment** (free-text input, always visible, optional).
   - Each field has a `?` FieldHelpTooltip. AuditBreadcrumb shows "Refrigeration › Machine Room › Exhaust"; "Machine Room" taps to `/audit/:auditId/section/refrigeration`.

2. **AC2 — Exhaust Natural logic.** When Exhaust Type = "Natural": Qty of Fans, HP of Motor, Power Rating, Set point ON, Set point OFF, Control by are hidden (removed from DOM); Control by defaults to "None" internally. Values cleared when switching from Forced → Natural.

3. **AC3 — Exhaust set-point cross-field validation.** When Exhaust Type = "Forced" and both set-points are entered: if Set point OFF ≥ Set point ON, block "Next" and show inline error "OFF set point must be lower than ON set point for cooling exhaust." (Same pattern as AC7 from Story 3.1 Ventilation.)

4. **AC4 — Exhaust auto-save.** 800 ms debounced PATCH to `PATCH /api/v1/audits/:auditId/machine-rooms/:roomId` with `{ data: { ...existingData, exhaust: { ... } } }`. `AutoSaveIndicator` shows ✓ Saved / retrying / error. `OfflineBanner` shown when offline. "Next" → navigates to `/audit/:auditId/section/refrigeration/racks`.

5. **AC5 — Rack List screen.** At `/audit/:auditId/section/refrigeration/racks`:
   - Fetches all racks via `GET /api/v1/audits/:auditId/machine-rooms/:roomId/racks`.
   - Each rack shows its designation (from `data.general.rackDesignation` or `Rack {rackNumber}` if blank) and completion status chip: **Not Started** (data is `{}`), **In Progress** (has some data but designation blank), **Complete** (has required designation).
   - An "**Add Rack**" button (data-testid="add-rack-btn") calls `POST …/racks`, then navigates to the new rack's General screen.
   - A "**Duplicate**" button per existing rack (data-testid=`duplicate-rack-{rackId}`) calls `POST …/racks/:rackId/duplicate`, then navigates to the new rack's General screen.
   - Loading skeleton shown while fetching. Error alert if fetch fails.
   - Breadcrumb: "Refrigeration › Machine Room › Racks". "Machine Room" → `/audit/:auditId/section/refrigeration`.

6. **AC6 — Rack General fields.** At `/audit/:auditId/section/refrigeration/rack/:rackId/general`:
   - **Rack Name/Designation\*** (required, dropdown: A | B | C | D | 1 | 2 | 3 | 4).
   - **Rack Type** (dropdown: Medium Temperature | Low Temperature | Dual Temperature).
   - **Rack Make** (dropdown: Hussmann | Tyler | Hill Phoenix | Kysor Warren | Bohn | Carrier | Heatcraft | Other).
   - **Rack Model/Serial Number** (text input, free-form).
   - **Age — Year of Manufacturing** (dropdown 1990–2026, optional).
   - **Year of Last Major Retrofit** (dropdown 1990–2027, optional).
   - **Refrigerant** (dropdown: R-22 | R-404A | R-407A | R-407C | R-410A | R-448A | R-449A | R-452A | R-454C | R-717 (Ammonia) | Other).
   - **Comment** (free-text input, optional).
   - Each field has a `?` FieldHelpTooltip. Breadcrumb: "Refrigeration › Machine Room › Rack N" where N is the `rackNumber`. "Machine Room" → `/audit/:auditId/section/refrigeration`.

7. **AC7 — Rack General validation.** Tapping "Next" with Rack Name/Designation empty blocks navigation; "Next" label shows "N required field(s) remaining"; empty field gets `border-danger` + `animate-shake`. No modal.

8. **AC8 — Rack auto-save.** 800 ms debounced PATCH to `PATCH /api/v1/audits/:auditId/machine-rooms/:roomId/racks/:rackId` with `{ data: formData }`. `AutoSaveIndicator` + `OfflineBanner` follow the established pattern.

9. **AC9 — Rack "Next" navigation.** Valid submission navigates to `/audit/:auditId/section/refrigeration/rack/:rackId/pipe-headers` (stub URL; Story 3.3 adds the route). The stub renders as a "Coming soon" div so Story 3.3's test harness can assert arrival.

10. **AC10 — Equipment duplication.** The `POST …/racks/:rackId/duplicate` endpoint creates a new rack, copying all fields from `data.general` **except** `rackDesignation` (which is cleared so the Auditor must select a new unique name). The new rack's `rackNumber` is the next available integer. Responds with the new rack entity. AUDITOR only.

11. **AC11 — Rack API: create.** `POST /api/v1/audits/:auditId/machine-rooms/:roomId/racks` (body: `{}`), AUDITOR only, audit must be DRAFT and auditor-owned. Returns the created `Rack` entity (200). Derives `rackNumber` = count of existing racks + 1 within the same `machineRoomId`. The `@@unique([machineRoomId, rackNumber])` DB constraint exists — service handles concurrent P2002 by re-deriving the next number and retrying once.

12. **AC12 — Rack API: list + get.** `GET /api/v1/audits/:auditId/machine-rooms/:roomId/racks` returns `{ racks: Rack[] }`, any authenticated role. `GET …/:rackId` returns `Rack | 404`.

13. **AC13 — Rack API: patch.** `PATCH /api/v1/audits/:auditId/machine-rooms/:roomId/racks/:rackId` with `{ data: Record<string, unknown> }`, AUDITOR only. Validates rack belongs to the given machine room (otherwise 404). Returns `{ savedAt, rackId }`.

14. **AC14 — Touch targets.** All interactive elements (dropdowns, buttons, help icons) meet `min-h-[48px] min-w-[48px]` (gloved-hand operation, AC11 from Story 3.1).

15. **AC15 — Redirect on missing machine room.** If the Exhaust, Rack List, or Rack General screen is accessed by direct URL and no machine room exists, `<Navigate>` to `/audit/:auditId/section/refrigeration` (the General screen which triggers machine room creation).

## Tasks / Subtasks

- [x] **Task 1 — Sprint-status update**
  - [x] Edit `docs/bmad/_bmad-output/implementation-artifacts/sprint-status.yaml`:
    - `3-2-rack-entry-navigation-and-equipment-duplication: ready-for-dev → in-progress`
    - `last_updated: 2026-05-16`

- [x] **Task 2 — Types: Rack schemas + Exhaust + dropdown constants**
  - [x] Edit `packages/types/src/audit.ts` — add after the machine room schemas:
    ```ts
    // Rack entity schema
    export const rackSchema = z.object({
      id: z.string(),
      tenantId: z.string().optional(),
      machineRoomId: z.string(),
      rackNumber: z.string(),
      data: z.record(z.unknown()),
      createdAt: z.string(),
      updatedAt: z.string(),
    })
    export type Rack = z.infer<typeof rackSchema>

    export const createRackResponseSchema = rackSchema
    export type CreateRackResponse = Rack

    export const listRacksResponseSchema = z.object({ racks: z.array(rackSchema) })
    export type ListRacksResponse = z.infer<typeof listRacksResponseSchema>

    export const getRackResponseSchema = rackSchema
    export type GetRackResponse = Rack

    export const patchRackParamsSchema = z.object({
      auditId: z.string().min(1),
      roomId: z.string().min(1),
      rackId: z.string().min(1),
    })
    export type PatchRackParams = z.infer<typeof patchRackParamsSchema>

    export const patchRackBodySchema = z.object({ data: z.record(z.unknown()) })
    export type PatchRackBody = z.infer<typeof patchRackBodySchema>

    export const patchRackResponseSchema = z.object({ savedAt: z.string(), rackId: z.string() })
    export type PatchRackResponse = z.infer<typeof patchRackResponseSchema>

    export const duplicateRackResponseSchema = rackSchema
    export type DuplicateRackResponse = Rack
    ```
  - [x] Edit `packages/types/src/forms/refrigeration.schema.ts` — add exhaust + rack general sub-schemas:
    ```ts
    export const mrExhaustDataSchema = z.object({
      exhaustType: z.enum(['Forced', 'Natural']),
      qtyOfFans: z.string().optional(),
      hpOfMotor: z.string().optional(),
      powerRatingW: z.string().optional(),
      setPointOn: z.number().optional(),
      setPointOff: z.number().optional(),
      controlBy: z.enum(['Thermostat', 'Timer', 'VFD', 'Leak Detector', 'None']).optional(),
      comment: z.string().optional(),
    })
    export type MrExhaustData = z.infer<typeof mrExhaustDataSchema>

    export const rackGeneralDataSchema = z.object({
      rackDesignation: z.string().min(1),
      rackType: z.enum(['Medium Temperature', 'Low Temperature', 'Dual Temperature']).optional(),
      rackMake: z.string().optional(),
      rackModelSerial: z.string().optional(),
      ageYear: z.string().optional(),
      lastRetrofitYear: z.string().optional(),
      refrigerant: z.string().optional(),
      comment: z.string().optional(),
    })
    export type RackGeneralData = z.infer<typeof rackGeneralDataSchema>
    ```
  - [x] Edit `packages/types/src/index.ts` — re-export `Rack`, `rackSchema`, list/get/patch/duplicate rack schemas + `mrExhaustDataSchema` + `rackGeneralDataSchema`.
  - [x] Edit `packages/types/src/forms/refrigeration.schema.ts` — add dropdown constants:
    ```ts
    export const EXHAUST_TYPE_OPTIONS = ['Forced', 'Natural'] as const
    export const EXHAUST_CONTROL_BY_OPTIONS = ['Thermostat', 'Timer', 'VFD', 'Leak Detector', 'None'] as const
    export const EXHAUST_QTY_OPTIONS = ['1', '2', '3', '4', '5', '6'] as const
    export const RACK_DESIGNATION_OPTIONS = ['A', 'B', 'C', 'D', '1', '2', '3', '4'] as const
    export const RACK_TYPE_OPTIONS = ['Medium Temperature', 'Low Temperature', 'Dual Temperature'] as const
    export const RACK_MAKE_OPTIONS = ['Hussmann', 'Tyler', 'Hill Phoenix', 'Kysor Warren', 'Bohn', 'Carrier', 'Heatcraft', 'Other'] as const
    export const RACK_REFRIGERANT_OPTIONS = ['R-22', 'R-404A', 'R-407A', 'R-407C', 'R-410A', 'R-448A', 'R-449A', 'R-452A', 'R-454C', 'R-717 (Ammonia)', 'Other'] as const
    // Year range helpers (string arrays for dropdowns)
    export const RACK_AGE_YEAR_OPTIONS: string[] = Array.from({ length: 37 }, (_, i) => String(1990 + i))
    export const RACK_RETROFIT_YEAR_OPTIONS: string[] = Array.from({ length: 38 }, (_, i) => String(1990 + i))
    ```
  - [x] Run `pnpm --filter @cems/types build` — must pass.

- [x] **Task 3 — Repo: Rack CRUD**
  - [x] Edit `apps/api/src/lib/audit-errors.ts` — add:
    ```ts
    export class RackNotFoundError extends Error {
      constructor() { super('Rack not found or not accessible'); this.name = 'RackNotFoundError' }
    }
    ```
  - [x] Edit `apps/api/src/middleware/error-handler.ts` — map `RackNotFoundError` → 404 RFC 7807 (`type: .../rack-not-found`, same pattern as `MachineRoomNotFoundError`).
  - [x] Create `apps/api/src/repositories/rack.repo.ts`:
    - `createRack(tx, input: { tenantId, machineRoomId, rackNumber, data? })` → `Rack`
    - `getRacksByMachineRoomId(tx, { machineRoomId })` → `Rack[]` (ordered by `createdAt asc`)
    - `getRackById(tx, { id })` → `Rack | null`
    - `upsertRackData(tx, { id, machineRoomId, tenantId, data })` → `{ savedAt, rackId }` — updates `racks.data`; throws `RackNotFoundError` on P2025; validates `machineRoomId` in WHERE to prevent cross-room write (same P2 pattern as machine room repo).
    - `duplicateRack(tx, { sourceId, machineRoomId, tenantId, rackNumber })` → `Rack` — reads source rack's `data`, clears `data.general?.rackDesignation`, creates new rack.
    - `mapRow` helper, `parseData` helper (copy pattern from `machine-room.repo.ts` exactly).
  - [x] Create `apps/api/src/repositories/rack.repo.test.ts` — 5 describe blocks (one per function), covering: happy path, P2025 error, cross-room prevention, empty data, duplicate data clearing.

- [x] **Task 4 — Service: Rack operations**
  - [x] Create `apps/api/src/services/rack.service.ts`:
    - `createRack({ machineRoomId, auditId }, ctx)` — AUDITOR only; verifies audit ownership + DRAFT status (call `getAuditOwnership`); derives next `rackNumber` from `getRacksByMachineRoomId().length + 1`; calls `createRack` repo; handles P2002 with one retry (re-derive rackNumber after catching); returns created rack.
    - `getRacks({ machineRoomId, auditId }, ctx)` — any role; calls repo.
    - `getRackById({ rackId, machineRoomId, auditId }, ctx)` — any role; calls repo; throws `RackNotFoundError` if null.
    - `patchRack({ rackId, machineRoomId, auditId, data }, ctx)` — AUDITOR only; verifies ownership + DRAFT; calls `upsertRackData`.
    - `duplicateRack({ rackId, machineRoomId, auditId }, ctx)` — AUDITOR only; verifies ownership + DRAFT; derives next rackNumber; calls `duplicateRack` repo.
    - All functions follow the `(input, ctx: { request })` pattern from `machine-room.service.ts`.
  - [x] Create `apps/api/src/services/rack.service.test.ts` — covers: happy paths, role guard (ADMIN → RoleNotPermittedError), AuditNotEditableError, RackNotFoundError, P2002 retry for createRack.

- [x] **Task 5 — Routes: Rack endpoints + registration**
  - [x] Create `apps/api/src/routes/racks.routes.ts`:
    - `POST /api/v1/audits/:auditId/machine-rooms/:roomId/racks` — AUDITOR, body: `{}`, response: `createRackResponseSchema`
    - `GET /api/v1/audits/:auditId/machine-rooms/:roomId/racks` — any role, response: `listRacksResponseSchema`
    - `GET /api/v1/audits/:auditId/machine-rooms/:roomId/racks/:rackId` — any role, response: `getRackResponseSchema`
    - `PATCH /api/v1/audits/:auditId/machine-rooms/:roomId/racks/:rackId` — AUDITOR, body: `patchRackBodySchema`, response: `patchRackResponseSchema`
    - `POST /api/v1/audits/:auditId/machine-rooms/:roomId/racks/:rackId/duplicate` — AUDITOR, body: `{}`, response: `duplicateRackResponseSchema`
    - All routes include `401`, `403`, `404`, `422` problem-detail response schemas.
  - [x] Edit `apps/api/src/app.ts` — import and call `registerRacksRoutes(app)` after `registerMachineRoomsRoutes`.
  - [x] Create `apps/api/src/routes/racks.routes.test.ts` — covers: 401 (no token), 403 (ADMIN for write endpoints), 200 happy paths, 404 rack-not-found, 422 missing body field. 3 describe blocks (POST, GET, PATCH). Use `vi.hoisted` + `vi.mock` pattern from `machine-rooms.routes.test.ts`.

- [x] **Task 6 — SPA: Machine Room Exhaust screen**
  - [x] Create `apps/audit-app/src/features/audit/MachineRoomExhaustPage.tsx`:
    - Uses `useMachineRooms(auditId)` to get the room (same pattern as `MachineRoomVentilationPage`). Redirects to General page if no room found (`<Navigate to={...} replace />`).
    - Uses `useAutoSaveMachineRoom(auditId, roomId)`.
    - `react-hook-form` with `mode: 'onSubmit'`, fields: `exhaustType`, `qtyOfFans`, `hpOfMotor`, `powerRatingW`, `setPointOn`, `setPointOff`, `controlBy`, `comment`.
    - `isForced = watch('exhaustType') === 'Forced'` — conditionally renders Forced-only fields.
    - Resets Forced-only fields (same `useEffect` pattern as Ventilation page) when switching to Natural.
    - Hydrates from `room.data?.exhaust` on mount (same `useEffect` + `setValue` pattern as Ventilation page).
    - Auto-save: `watch()` subscription → `autoSave.save({ ...existingData, exhaust: values })`. Must merge with existing machine room data keys, NOT replace entire `data` blob (fetch current data from `useMachineRooms` result; spread existing keys first).
    - Cross-field validation: `setPointOff` rule — same logic as Ventilation (`offLowerThanOn`). `errorCount` includes both `exhaustTypeError` + `setPointOffError`.
    - On valid `onValid`: `autoSave.flush()` then navigate to `/audit/${auditId}/section/refrigeration/racks`.
    - `aria-busy="true"` skeleton while loading; `role="alert"` on error.
    - data-testid: `exhaust-type`, `qty-fans`, `hp-motor`, `power-rating`, `set-point-on`, `set-point-off`, `control-by`, `comment-field`, `next-btn`.
  - [x] Create `apps/audit-app/src/features/audit/MachineRoomExhaustPage.test.tsx` — 8 tests:
    - Shows skeleton while loading
    - Shows error alert when GET fails
    - Renders form fields after successful load
    - Natural type hides conditional fields
    - Forced type shows conditional fields
    - Invalid set-point cross-field shows error on Next tap
    - Empty Exhaust Type blocks navigation
    - Valid submit navigates to racks page

- [x] **Task 7 — SPA: rack-api.ts hooks**
  - [x] Create `apps/audit-app/src/features/audit/rack-api.ts`:
    - `useRacks(auditId: string | null, roomId: string | null)` — `useQuery` on `[audits, auditId, machine-rooms, roomId, racks]`, calls `GET /api/v1/audits/:auditId/machine-rooms/:roomId/racks`, `staleTime: 30_000`.
    - `useCreateRack()` — `useMutation` calling `POST …/racks`.
    - `useRack(auditId: string | null, roomId: string | null, rackId: string | null)` — `useQuery` for single rack hydration, `staleTime: 30_000`.
    - `useDuplicateRack()` — `useMutation` calling `POST …/racks/:rackId/duplicate`.
    - `useAutoSaveRack(auditId, roomId, rackId)` — same debounced auto-save hook pattern as `useAutoSaveMachineRoom`; calls `PATCH /api/v1/audits/:auditId/machine-rooms/:roomId/racks/:rackId`.
    - Export `RackAutoSaveState` type alias (re-use `AutoSaveState` from `machine-room-api.ts`).

- [x] **Task 8 — SPA: Rack List screen**
  - [x] Create `apps/audit-app/src/features/audit/RackListPage.tsx`:
    - `useParams` for `auditId`. Calls `useMachineRooms(auditId)` to get `roomId`. Redirects to General if no room.
    - Calls `useRacks(auditId, roomId)`.
    - Renders a list of rack cards: each shows designation (from `data.general?.rackDesignation` or `Rack {rackNumber}`) + completion status chip.
    - Status chip logic: `'Complete'` if `data.general?.rackDesignation`, `'In Progress'` if `Object.keys(data).length > 0`, `'Not Started'` otherwise.
    - "Add Rack" button (`data-testid="add-rack-btn"`): calls `useCreateRack().mutate({ auditId, roomId })`, navigates to `/audit/${auditId}/section/refrigeration/rack/${newRack.id}/general`.
    - "Duplicate" per rack (`data-testid="duplicate-rack-{rack.id}"`): calls `useDuplicateRack().mutate({ auditId, roomId, rackId: rack.id })`, navigates to new rack's General screen.
    - Loading skeleton while fetching. Error alert on fetch failure.
    - Breadcrumb: `[{ label: 'Refrigeration', to: /audit/:auditId }, { label: 'Machine Room', to: /audit/:auditId/section/refrigeration }, { label: 'Racks' }]`.
    - data-testid: `rack-list`, `rack-card-{rackId}`, `rack-status-{rackId}`, `add-rack-btn`, `duplicate-rack-{rackId}`.
  - [x] Create `apps/audit-app/src/features/audit/RackListPage.test.tsx` — 7 tests:
    - Shows skeleton while loading
    - Shows error alert when GET fails
    - Renders rack list with status chips
    - "Not Started" rack shows correct chip
    - "Complete" rack shows correct chip
    - "Add Rack" triggers mutation and navigates
    - "Duplicate" triggers mutation and navigates

- [x] **Task 9 — SPA: Rack General screen**
  - [x] Create `apps/audit-app/src/features/audit/RackGeneralPage.tsx`:
    - `useParams` for `auditId` + `rackId`. Calls `useMachineRooms(auditId)` to get `roomId`. Redirects if no room.
    - Calls `useRack(auditId, roomId, rackId)` for data hydration.
    - Uses `useAutoSaveRack(auditId, roomId, rackId)`.
    - `react-hook-form`, `mode: 'onSubmit'`, fields: `rackDesignation`, `rackType`, `rackMake`, `rackModelSerial`, `ageYear`, `lastRetrofitYear`, `refrigerant`, `comment`.
    - Hydrates from `rack.data?.general` in `useEffect`.
    - Auto-save: `watch()` subscription → `autoSave.save({ general: getValues() })`.
    - `onInvalid` sets `attempted=true`. `errorCount = designationError ? 1 : 0`.
    - On valid: `autoSave.flush()` → navigate to `/audit/${auditId}/section/refrigeration/rack/${rackId}/pipe-headers` (stub; Story 3.3).
    - Breadcrumb: `[{ label: 'Refrigeration', to: /audit/:auditId }, { label: 'Machine Room', to: .../refrigeration }, { label: 'Racks', to: .../refrigeration/racks }, { label: `Rack ${rackNumber}` }]` — use `rack.rackNumber` from the query data. While loading, show `'Rack ...'`.
    - Loading skeleton + error alert patterns same as General/Ventilation pages.
    - data-testid: `rack-designation`, `rack-type`, `rack-make`, `rack-model-serial`, `age-year`, `last-retrofit-year`, `refrigerant`, `comment-field`, `next-btn`.
  - [x] Create `apps/audit-app/src/features/audit/RackGeneralPage.test.tsx` — 8 tests:
    - Shows skeleton while loading
    - Shows error alert when GET fails
    - Renders all form fields
    - Empty designation blocks navigation (Next shows "N required field(s) remaining")
    - Valid form navigates to pipe-headers stub
    - Hydrates form from saved data
    - Field change triggers auto-save after debounce (fake timers)
    - Passes axe accessibility scan

- [x] **Task 10 — App.tsx routing update**
  - [x] Edit `apps/audit-app/src/App.tsx`:
    - Import `MachineRoomExhaustPage`, `RackListPage`, `RackGeneralPage`.
    - Add routes **before** the catch-all `/:sectionId` route:
      ```tsx
      <Route path="/audit/:auditId/section/refrigeration/exhaust" element={<RequireAuth ...><MachineRoomExhaustPage /></RequireAuth>} />
      <Route path="/audit/:auditId/section/refrigeration/racks" element={<RequireAuth ...><RackListPage /></RequireAuth>} />
      <Route path="/audit/:auditId/section/refrigeration/rack/:rackId/general" element={<RequireAuth ...><RackGeneralPage /></RequireAuth>} />
      {/* Stub for Story 3.3 pipe-headers route (so RackGeneralPage.test.tsx can assert arrival) */}
      <Route path="/audit/:auditId/section/refrigeration/rack/:rackId/pipe-headers" element={<RequireAuth ...><div data-testid="pipe-headers-stub">Pipe Headers — Story 3.3</div></RequireAuth>} />
      ```
    - Routes must be ordered **most-specific first** (exhaust before racks before rack/:rackId before the existing `:sectionId` catch-all).

- [x] **Task 11 — Validations: lint + type-check + tests (DoD)**
  - [x] `pnpm turbo run lint type-check test` — all 0 errors, 0 lint errors in SPAs; all tests pass.
  - [x] Verify axe test passes for at least `MachineRoomExhaustPage` and `RackGeneralPage`.
  - [x] Check Story 3.1's `MachineRoomVentilationPage.test.tsx` still passes (navigation from Ventilation → Exhaust is now a real route, not a stub).

## Dev Notes

### Critical Architecture Context

**Rack DB model is ALREADY IN SCHEMA — no migration needed.** Verify with:
```bash
grep -A 20 "model Rack" packages/db/prisma/schema.prisma
```
The `Rack` table has `@@unique([machineRoomId, rackNumber])`. Pattern for `rackNumber`:
- System-assigned sequential string: `"1"`, `"2"`, `"3"`, ...
- User-selected display name stored in `data.general.rackDesignation`

**Repo layer patterns — match exactly what Story 3.1 established:**
```ts
// machine-room.repo.ts patterns to replicate:
type PrismaLike = any  // eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseData(raw: string): Record<string, unknown> { ... }
function mapRow(row): Rack { ... }
// All functions take (tx, input) — tx is the RLS transaction handle
```

**Service layer patterns — match `machine-room.service.ts` exactly:**
```ts
// Ownership verification pattern:
const ownership = await getAuditOwnership(tx, auditId)
if (!ownership || ownership.auditorUserId !== rls.userId || ownership.status !== AuditStatus.DRAFT) {
  throw new AuditNotEditableError()
}
// Role check pattern:
if (rls.role !== UserRole.AUDITOR) throw new RoleNotPermittedError()
// Import RLS context:
const rls = (request as { rlsContext?: RlsContext }).rlsContext
```

**Route layer patterns — match `machine-rooms.routes.ts` exactly:**
```ts
// Use fastifySchemaFromZod, requireRole, vi.hoisted + vi.mock in tests
// Same preHandler pattern: requireRole([UserRole.AUDITOR]) for writes
// requireRole([UserRole.AUDITOR, UserRole.ADMIN, UserRole.CLIENT]) for reads
```

**SPA auto-save pattern for Exhaust page — data merging is critical:**
The Exhaust page must save `{ ...existingMachineRoomData, exhaust: exhaustValues }` — NOT just `{ exhaust: exhaustValues }`, which would wipe the `general` and `ventilation` sub-keys.

Hydrate existing data from the machine room query:
```ts
const room = machineRoomsQ.data?.machineRooms[0]
// In the auto-save subscription:
const allData = { ...(room?.data ?? {}), exhaust: buildExhaustPayload(values) }
autoSave.save(allData)
```

This is the same approach Ventilation uses internally but the `watch()` subscription needs `room` in closure (either from state or from the query result directly).

**Exhaust page redirects:**
The Exhaust page receives its `roomId` through `useMachineRooms`, identical to `MachineRoomVentilationPage`. Copy that page as the structural template.

**RackListPage and RackGeneralPage fetch roomId indirectly:**
```ts
const machineRoomsQ = useMachineRooms(auditId ?? null)
const roomId = machineRoomsQ.data?.machineRooms[0]?.id ?? null
```
Both pages should redirect to `/audit/:auditId/section/refrigeration` when `machineRoomsQ.data?.machineRooms.length === 0`.

**Completion status logic for Rack List:**
```ts
function getRackStatus(rack: Rack): 'Not Started' | 'In Progress' | 'Complete' {
  const general = rack.data['general'] as { rackDesignation?: string } | undefined
  if (general?.rackDesignation) return 'Complete'
  if (Object.keys(rack.data).length > 0) return 'In Progress'
  return 'Not Started'
}
```

**Duplicate endpoint clears designation:**
```ts
// In duplicateRack repo fn:
const sourceData = parseData(sourceRack.data)
const sourceGeneral = sourceData['general'] as Record<string, unknown> | undefined
const newGeneral = sourceGeneral
  ? { ...sourceGeneral, rackDesignation: undefined }  // clear required field
  : undefined
const newData = { ...sourceData, general: newGeneral ? newGeneral : undefined }
```

**P2002 retry for createRack (same pattern as Story 3.1 D3 fix):**
```ts
try {
  return await createRackRepo(tx, { ... rackNumber: String(existingCount + 1) })
} catch (err: unknown) {
  if (isPrismaP2002(err)) {
    // Concurrent create: re-count and retry once
    const racks2 = await getRacksByMachineRoomId(tx, { machineRoomId })
    return await createRackRepo(tx, { ... rackNumber: String(racks2.length + 1) })
  }
  throw err
}
// Helper: isPrismaP2002(err) = err != null && typeof err === 'object' && 'code' in err && (err as any).code === 'P2002'
```

**Exhaust dropdown imports:**
```ts
import {
  EXHAUST_TYPE_OPTIONS,
  EXHAUST_CONTROL_BY_OPTIONS,
  EXHAUST_QTY_OPTIONS,
  RACK_DESIGNATION_OPTIONS,
  RACK_TYPE_OPTIONS,
  RACK_MAKE_OPTIONS,
  RACK_REFRIGERANT_OPTIONS,
  RACK_AGE_YEAR_OPTIONS,
  RACK_RETROFIT_YEAR_OPTIONS,
} from '@cems/types'
```

**Test mock pattern for rack routes test:**
```ts
const { fakeTx, rackServiceMock } = vi.hoisted(() => ({
  fakeTx: Symbol('fake-tx'),
  rackServiceMock: {
    createRack: vi.fn(),
    getRacks: vi.fn(),
    getRackById: vi.fn(),
    patchRack: vi.fn(),
    duplicateRack: vi.fn(),
  },
}))
vi.mock('../services/rack.service.js', () => rackServiceMock)
```

**API path structure for racks:**
```
POST   /api/v1/audits/:auditId/machine-rooms/:roomId/racks
GET    /api/v1/audits/:auditId/machine-rooms/:roomId/racks
GET    /api/v1/audits/:auditId/machine-rooms/:roomId/racks/:rackId
PATCH  /api/v1/audits/:auditId/machine-rooms/:roomId/racks/:rackId
POST   /api/v1/audits/:auditId/machine-rooms/:roomId/racks/:rackId/duplicate
```

**SectionEditPage stub for `pipe-headers`:**
Story 3.3 will replace the stub `<div data-testid="pipe-headers-stub">` with the real Pipe Headers page. For now the stub is fine — same pattern as how Story 3.1 used the exhaust stub.

**Note on `audit_sections` tracking:**
The `upsertRackData` repo function does NOT need to update `audit_sections.data` (unlike `upsertMachineRoomData`). The `audit_sections` row for 'refrigeration' is already created when the machine room is created. Rack-level completion tracking is deferred to Story 3.5 (Refrigeration Section Completion).

**Breadcrumb for Rack General (dynamic rackNumber):**
```tsx
const rack = rackQ.data  // from useRack(...)
<AuditBreadcrumb segments={[
  { label: 'Refrigeration', to: `/audit/${auditId}` },
  { label: 'Machine Room', to: `/audit/${auditId}/section/refrigeration` },
  { label: 'Racks', to: `/audit/${auditId}/section/refrigeration/racks` },
  { label: rack ? `Rack ${rack.rackNumber}` : 'Rack ...' },
]} />
```

### API Testing Layer (three-layer pattern)
Follow the established pattern (see CLAUDE.md § API Testing Pattern):
1. **Route tests** — mock service; verify HTTP status codes, role guards, 401/403/404/422.
2. **Service tests** — mock repo; verify business logic (role guard, ownership check, P2002 retry).
3. **Repo tests** — mock Prisma `tx`; verify WHERE clauses, data mapping, P2025 handling.

### Key files modified by Story 3.1 (context for Story 3.2)
- `machine-room-api.ts` — `useAutoSaveMachineRoom` pattern to replicate for `useAutoSaveRack`
- `MachineRoomVentilationPage.tsx` — structural template for `MachineRoomExhaustPage.tsx`
- `machine-room.repo.ts` — `upsertMachineRoomData` WITH `auditId` in WHERE (P2 fix) — copy for `upsertRackData`
- `machine-room.service.ts` — `getOrCreateMachineRoom` P2002 retry pattern — copy for `createRack`
- `machine-rooms.routes.ts` — route/schema pattern to replicate for `racks.routes.ts`
- `deferred-work.md` — 5 deferred items from 3.1 review (no action needed in 3.2)

### Dropdown Option Rationale
- **Rack Makes**: Major North American commercial refrigeration manufacturers (Hussmann, Tyler/Carrier, Hill Phoenix, Kysor Warren, Bohn, Heatcraft). "Other" always last per CEMS convention.
- **Refrigerants**: Focus on HFC/HFO blends actively used in Canadian supermarkets + R-717 (Ammonia, relevant for AC1 Leak Detector "Control by" requirement from Epic 3A).
- **Year ranges**: 1990 (oldest practical install base) to 2026 (current year) for age; +1 year (to 2027) for retrofit since next-year work may be planned.

## Dev Agent Record

### Model
claude-opus-4-7[1m]

### Debug Log

- `pnpm --filter @cems/types build` — passed.
- `pnpm turbo run type-check` — 11/11 packages pass. (Initial rack.repo.test.ts failures: untyped `vi.fn` mocks gave `.mock.calls` a zero-length tuple type — fixed by adding explicit `vi.fn<(arg: AnyArg) => Promise<unknown>>` signatures, matching `machine-room.repo.test.ts`.)
- `pnpm turbo run lint` — 8/8 packages pass, 0 errors. (api shows pre-existing "unused eslint-disable directive" warnings in unrelated files; api does not enforce `--max-warnings=0`. SPAs pass with 0 warnings.)
- `pnpm --filter api exec vitest run` — 33 files / 326 tests pass, 1 skipped. No API regressions.
- New test files all green: `rack.repo.test.ts` (12), `rack.service.test.ts` (14), `racks.routes.test.ts` (14), `MachineRoomExhaustPage.test.tsx` (9, incl. axe), `RackListPage.test.tsx` (7), `RackGeneralPage.test.tsx` (8, incl. axe).
- Story 3.1 `MachineRoomVentilationPage.test.tsx` still passes (9 tests) — Ventilation → Exhaust is now a real route.
- **Pre-existing failures (NOT regressions from 3.2):** `AutoSaveIndicator.test.tsx` (1) and `useAutoSaveSection.test.ts` (2) fail in the working tree. These four files (`AutoSaveIndicator.{tsx,test.tsx}`, `useAutoSaveSection.{ts,test.ts}`) carried uncommitted modifications from a prior session before this story began. Verified by stashing them: the committed (HEAD) versions pass all 13 tests; the working-tree versions fail 3. Story 3.2 touches none of these files, so the failures are independent WIP and out of scope here.

### Completion Notes

Story 3.2 ships the Machine Room Exhaust screen, the full Rack entity API, and the three Rack SPA screens (List / General + duplication).

- **Types** — Added `rackSchema` + create/list/get/patch/duplicate rack schemas to `audit.ts`; `mrExhaustDataSchema`, `rackGeneralDataSchema`, and 9 dropdown-option constants to `refrigeration.schema.ts`. `index.ts` already re-exports both files via `export *`, so no edit was needed there.
- **API** — `RackNotFoundError` (404 `rack-not-found`) added to `audit-errors.ts` + `error-handler.ts`. `rack.repo.ts` mirrors `machine-room.repo.ts` (`parseData`/`mapRow`, `machineRoomId` folded into the `upsertRackData` WHERE for the cross-room P2 guard). `rack.service.ts` mirrors `machine-room.service.ts` (AUDITOR-only writes, ownership + DRAFT checks, P2002 re-derive-and-retry-once for both `createRack` and `duplicateRack`). `racks.routes.ts` registers the 5 endpoints; wired into `app.ts` after `registerMachineRoomsRoutes`.
- **SPA** — `MachineRoomExhaustPage` extends the machine room `data` with an `exhaust` sub-key; the auto-save subscription merges `{ ...existingRoomData, exhaust }` via a ref so `general`/`ventilation` are never wiped. `rack-api.ts` adds `useRacks`/`useRack`/`useCreateRack`/`useDuplicateRack` and `useAutoSaveRack` (debounced PATCH, mirrors `useAutoSaveMachineRoom`). `RackListPage` shows per-rack completion chips (Not Started / In Progress / Complete) with Add + Duplicate. `RackGeneralPage` is the 3B.1.1 data-entry form; "Next" routes to the Story 3.3 `pipe-headers` stub.
- **Routing** — `App.tsx` gains the exhaust/racks/rack-general routes plus a `pipe-headers` stub, ordered most-specific-first ahead of the `:sectionId` catch-all.

All 15 ACs satisfied. Touch targets use `min-h-[48px]`; redirects to the General page guard direct-URL access when no machine room exists.

### File List

**Added**
- `apps/api/src/repositories/rack.repo.ts`
- `apps/api/src/repositories/rack.repo.test.ts`
- `apps/api/src/services/rack.service.ts`
- `apps/api/src/services/rack.service.test.ts`
- `apps/api/src/routes/racks.routes.ts`
- `apps/api/src/routes/racks.routes.test.ts`
- `apps/audit-app/src/features/audit/MachineRoomExhaustPage.tsx`
- `apps/audit-app/src/features/audit/MachineRoomExhaustPage.test.tsx`
- `apps/audit-app/src/features/audit/rack-api.ts`
- `apps/audit-app/src/features/audit/RackListPage.tsx`
- `apps/audit-app/src/features/audit/RackListPage.test.tsx`
- `apps/audit-app/src/features/audit/RackGeneralPage.tsx`
- `apps/audit-app/src/features/audit/RackGeneralPage.test.tsx`

**Modified**
- `packages/types/src/audit.ts`
- `packages/types/src/forms/refrigeration.schema.ts`
- `apps/api/src/lib/audit-errors.ts`
- `apps/api/src/middleware/error-handler.ts`
- `apps/api/src/app.ts`
- `apps/audit-app/src/App.tsx`
- `docs/bmad/_bmad-output/implementation-artifacts/sprint-status.yaml`

## Change Log

| Date       | Change |
|------------|--------|
| 2026-05-16 | Story created via create-story from Epic 3A Machine Room + Epic 3B Refrigeration Rack + epic-03-refrigeration-data-collection-core-audit-engine.md |
| 2026-05-17 | Implemented Story 3.2 — Machine Room Exhaust screen, Rack entity API (CRUD + duplicate), Rack List + Rack General SPA screens, App.tsx routing. All 15 ACs satisfied; 64 new tests added. |
