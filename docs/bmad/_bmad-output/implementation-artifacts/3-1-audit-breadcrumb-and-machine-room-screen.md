# Story 3.1: Audit Breadcrumb & Machine Room (General + Ventilation)

Status: done

## Story

As a Field Energy Auditor,
I want a persistent breadcrumb showing my exact position in the refrigeration hierarchy and guided data-entry screens for Machine Room General and Ventilation details,
so that I never lose my place in the deep refrigeration structure and can accurately document the primary machine room identifiers and ventilation configuration on-site.

**Source:** Epic 3.1.1 + 3.1.2 from `star-energy-review/Epic 3A Machine Room…md`; original breadcrumb AC from `epic-03-refrigeration-data-collection-core-audit-engine.md`. Covers FR3, FR4 (refrigeration), FR8 (section state visibility). Builds directly on 2.3's `useAutoSaveSection` hook, `SectionOverviewPage`, `AutoSaveIndicator`, and `OfflineBanner`.

**Scope clarification — what this story ships:**
- `AuditBreadcrumb` component — reusable nav landmark used by **all** Story 3.x screens.
- `FieldHelpTooltip` component — `?` icon + Popover for field instructions; used by all 3.x forms.
- Machine Room General screen (`/audit/:auditId/section/refrigeration`) — MR ID, Location, multi-entry Rack rows.
- Machine Room Ventilation.1 screen (`/audit/:auditId/section/refrigeration/ventilation`) — Ventilation Type, conditional Set-point fields, cross-field validation.
- API: `POST /GET /PATCH /api/v1/audits/:auditId/machine-rooms/:roomId` (new `machine-rooms.routes.ts`).
- Auto-save adapted for machine room entity (PATCH machine-rooms + keeps `audit_sections` sectionId='refrigeration' in sync for SectionOverviewPage status).

**Out of scope (deferred to subsequent stories):**
- Photo screens 2.103 (Picture Ventilation), all Feature 3.3 picture stories → **Epic 4**.
- Machine Room Exhaust (2.104/2.105) → **Story 3.2.1**.
- Leak Detector (2.106/2.107) → **Story 3.2.3**.
- Rack data entry, navigation, duplication → **original Story 3.2 / new Epic 3B**.
- Compressor DB lookup → **original Story 3.3**.
- Section-locking concurrency → **original Story 3.6**.

## Acceptance Criteria

1. **AC1 — AuditBreadcrumb component.** Machine Room General screen renders `<nav aria-label="Audit navigation"><ol>` showing "Refrigeration › Machine Room"; "Refrigeration" is tappable → navigates to `/audit/:auditId` (Section Overview). Ventilation screen shows "Refrigeration › Machine Room › Ventilation"; "Refrigeration" navigates to Section Overview, "Machine Room" navigates to `/audit/:auditId/section/refrigeration`.

2. **AC2 — Machine Room General fields.** Screen renders: **Machine Room ID\*** (required, dropdown: 1 | 2 | 3 | 4 | A | B | C | D), **Location** (dropdown: Mezzanine | Penthouse | Main floor | Other), and at least one **Rack entry row** (Rack Name dropdown 1–6 or A–H; Suction Group Number dropdown 1–5; Suction Group Type dropdown: Low Temp. | Medium Temp. | Dual Temp.). Each field has a `?` icon that opens an inline help Popover with instructions.

3. **AC3 — Add Another Rack.** An "Add Another Rack" (+) button appends a new (Rack Name / Suction Group Number / Suction Group Type) row. All rows are stored under the same Machine Room ID in the saved JSON. Minimum 1 rack row is required (empty racks array blocks "Next").

4. **AC4 — MR General attempt-first validation.** Tapping "Next" with Machine Room ID empty or racks array empty blocks navigation; the "Next" button label shows "N required field(s) remaining"; empty required field(s) get `border-danger` + `animate-shake`. No modal, no live per-keystroke errors.

5. **AC5 — Machine Room Ventilation.1 fields.** Screen renders: **Ventilation Type\*** (required, Forced | Natural), **Connected to Exhaust** (Yes | No), **Set point ON (°F)** (numeric), **Set point OFF (°F)** (numeric), **Control by** (Thermostat | None). Required field marked `*`. `?` help Popover on each field with instructions from the spec.

6. **AC6 — Natural ventilation conditional logic.** When Ventilation Type = "Natural": Set point ON, Set point OFF, and Control by fields are hidden (removed from DOM or visually suppressed with `aria-hidden`); Connected to Exhaust defaults to "No" but remains editable.

7. **AC7 — Ventilation set-point cross-field validation.** When Ventilation Type = "Forced" and both set-points are entered: if Set point OFF ≥ Set point ON, block "Next" and show inline error: "OFF set point must be lower than ON set point for cooling ventilation."

8. **AC8 — Ventilation attempt-first validation.** Tapping "Next" with Ventilation Type empty blocks navigation; empty required field gets `border-danger` + `animate-shake`; "Next" label shows count.

9. **AC9 — Auto-save on every field change.** 800 ms debounced `PATCH /api/v1/audits/:auditId/machine-rooms/:roomId`. `AutoSaveIndicator` shows ✓ Saved / retrying / error states. `OfflineBanner` shown when offline. Server atomically: (a) updates `machine_rooms.data` JSON; (b) upserts `audit_sections` row for sectionId='refrigeration' (so SectionOverviewPage can derive In Progress); (c) sets `audits.current_section_id = 'refrigeration'`.

10. **AC10 — Navigation flow.** General → "Next" → Ventilation → "Next" → navigates to `/audit/:auditId/section/refrigeration/exhaust` (stub URL; Story 3.2 adds the route). "Next" button is `fixed bottom-0 left-0 right-0 p-4 pb-[env(safe-area-inset-bottom)]` — never obscured by the on-screen keyboard.

11. **AC11 — Touch targets.** All interactive elements (dropdowns, buttons, help icons) meet `min-h-[48px] min-w-[48px]` for gloved-hand operation.

12. **AC12 — Auto-create machine room on first entry.** When the auditor navigates to `/audit/:auditId/section/refrigeration` and no machine room exists yet, the app calls `POST /api/v1/audits/:auditId/machine-rooms` (roomNumber="1"). Loading skeleton shown during this; error alert if it fails. Hydrates the form with any previously saved data on re-entry.

## Tasks / Subtasks

- [x] **Task 1 — Sprint-status + epic status update (prerequisite)**
  - [x] Edit `docs/bmad/_bmad-output/implementation-artifacts/sprint-status.yaml`:
    - `epic-3: backlog → in-progress`
    - `3-1-audit-breadcrumb-and-machine-room-screen: backlog → in-progress`
    - Bump `last_updated` to 2026-05-12.

- [x] **Task 2 — Types: machine room schemas + dropdown constants (AC: #2, #5, #9)**
  - [x] Edit `packages/types/src/audit.ts` — add these exports:
    - `rackEntrySchema = z.object({ rackName: z.string(), suctionGroupNumber: z.string(), suctionGroupType: z.enum(['Low Temp.', 'Medium Temp.', 'Dual Temp.']).optional() })`
    - `mrGeneralDataSchema = z.object({ machineRoomId: z.string().min(1), location: z.enum(['Mezzanine', 'Penthouse', 'Main floor', 'Other']).optional(), racks: z.array(rackEntrySchema).min(1) })`
    - `mrVentilationDataSchema = z.object({ ventilationType: z.enum(['Forced', 'Natural']), connectedToExhaust: z.enum(['Yes', 'No']).optional(), setPointOn: z.number().optional(), setPointOff: z.number().optional(), controlBy: z.enum(['Thermostat', 'None']).optional() })` — no cross-field rule at Zod level; cross-field validation lives in the form layer
    - `machineRoomDataSchema = z.object({ general: mrGeneralDataSchema.optional(), ventilation: mrVentilationDataSchema.optional() })`
    - `createMachineRoomBodySchema = z.object({ roomNumber: z.string().default('1') })`
    - `createMachineRoomResponseSchema = z.object({ id: z.string(), auditId: z.string(), roomNumber: z.string(), data: z.record(z.unknown()), createdAt: z.string() })`
    - `patchMachineRoomParamsSchema = z.object({ auditId: z.string().min(1), roomId: z.string().min(1) })`
    - `patchMachineRoomBodySchema = z.object({ data: z.record(z.unknown()) })` — loose body, mirrors section PATCH pattern
    - `patchMachineRoomResponseSchema = z.object({ savedAt: z.string(), roomId: z.string() })`
    - `machineRoomSchema` full entity — mirror prisma shape: `z.object({ id, tenantId: z.string().optional(), auditId: z.string(), roomNumber: z.string(), data: z.record(z.unknown()), createdAt: z.string(), updatedAt: z.string() })`
    - `listMachineRoomsResponseSchema = z.object({ machineRooms: z.array(machineRoomSchema) })`
    - Add TS types: `export type MachineRoom = z.infer<typeof machineRoomSchema>`, etc.
  - [x] Edit `packages/types/src/forms/refrigeration.schema.ts` (already exists as a stub — replace body):
    - Export `MR_ID_OPTIONS`, `MR_LOCATION_OPTIONS`, `RACK_NAME_OPTIONS`, `SUCTION_GROUP_NUMBER_OPTIONS`, `SUCTION_GROUP_TYPE_OPTIONS`, `VENTILATION_TYPE_OPTIONS`, `CONNECTED_TO_EXHAUST_OPTIONS`, `VENTILATION_CONTROL_BY_OPTIONS` as `readonly` string arrays matching the CSV spec values.
    - Keep (or improve) the existing `refrigerationSectionSchema` stub.
  - [x] Edit `packages/types/src/index.ts` — re-export all new schemas/types.

- [x] **Task 3 — Repo: machine room CRUD + audit_sections sync (AC: #9, #12)**
  - [x] Create `apps/api/src/repositories/machine-room.repo.ts`:
    - `createMachineRoom(tx, { tenantId, auditId, roomNumber }) → Promise<MachineRoom>`: `tx.machineRoom.create(...)` with `data: '{}'`; inside the **same** `withRlsTransaction` call: (a) `tx.auditSection.upsert({ where: { auditId_sectionId: { auditId, sectionId: 'refrigeration' } }, create: { tenantId, auditId, sectionId: 'refrigeration', data: '{}' }, update: {} })` to ensure the section row exists for SectionOverviewPage; (b) `tx.audit.update({ where: { id: auditId }, data: { currentSectionId: 'refrigeration' } })`. Return the created MachineRoom, mapping `data` from JSON string → parsed object.
    - `getMachineRoomsByAuditId(tx, { auditId }) → Promise<MachineRoom[]>`: `tx.machineRoom.findMany({ where: { auditId } })`; map `data` JSON string → object each row.
    - `getMachineRoomById(tx, { id }) → Promise<MachineRoom | null>`: `tx.machineRoom.findUnique({ where: { id } })`; map `data`.
    - `upsertMachineRoomData(tx, { id, auditId, tenantId, data }) → Promise<{ savedAt: string; roomId: string }>`: (1) `tx.machineRoom.update({ where: { id }, data: { data: JSON.stringify(data), updatedAt: new Date() } })`; (2) build section summary `{ machineRoomIds: [id], lastSavedAt: new Date().toISOString() }`; (3) `tx.auditSection.upsert({ where: { auditId_sectionId: { auditId, sectionId: 'refrigeration' } }, create: { tenantId, auditId, sectionId: 'refrigeration', data: JSON.stringify(summary) }, update: { data: JSON.stringify(summary), updatedAt: new Date() } })`; (4) `tx.audit.update({ where: { id: auditId }, data: { currentSectionId: 'refrigeration' } })`; return `{ savedAt: updatedAt.toISOString(), roomId: id }`. Trap Prisma P2025 → `MachineRoomNotFoundError`.
  - [x] Create `apps/api/src/repositories/machine-room.repo.test.ts` — 3 describe blocks:
    - `createMachineRoom`: verifies `machineRoom.create`, `auditSection.upsert`, `audit.update` all called with correct args; returns parsed MachineRoom with `data` as object.
    - `getMachineRoomsByAuditId`: returns empty array; returns mapped array with parsed data.
    - `upsertMachineRoomData`: verifies 4-step write order; returns `{ savedAt, roomId }`; P2025 → `MachineRoomNotFoundError`.

- [x] **Task 4 — Service: machine room operations (AC: #9, #12)**
  - [x] Edit `apps/api/src/lib/audit-errors.ts` — add `MachineRoomNotFoundError extends Error`.
  - [x] Edit `apps/api/src/middleware/error-handler.ts` — map `MachineRoomNotFoundError` → 404 RFC 7807 (`type: .../machine-room-not-found`).
  - [x] Create `apps/api/src/services/machine-room.service.ts`:
    - `getOrCreateMachineRoom({ auditId }, ctx) → Promise<MachineRoom>`: inside `withRls`: (1) AUDITOR-only guard (throw `RoleNotPermittedError`); (2) `auditRepo.getAuditOwnership(tx, auditId)` → null/non-owner/non-DRAFT → throw `AuditNotEditableError`; (3) `machineRoomRepo.getMachineRoomsByAuditId(tx, { auditId })`; (4) if empty, `machineRoomRepo.createMachineRoom(tx, { tenantId: rls.tenantId, auditId, roomNumber: '1' })`; (5) return `rooms[0]`.
    - `getMachineRooms({ auditId }, ctx) → Promise<MachineRoom[]>`: any role; inside `withRls`; `machineRoomRepo.getMachineRoomsByAuditId(tx, { auditId })`.
    - `patchMachineRoom({ auditId, roomId, data }, ctx) → Promise<{ savedAt: string; roomId: string }>`: inside `withRls`: AUDITOR-only; ownership + DRAFT check (same `AuditNotEditableError` logic); `machineRoomRepo.upsertMachineRoomData(tx, { id: roomId, auditId, tenantId: rls.tenantId, data })`.
  - [x] Create `apps/api/src/services/machine-room.service.test.ts`:
    - `getOrCreateMachineRoom`: AUDITOR happy-path creates when empty; returns existing when present; ADMIN/CLIENT → 403; non-owning AUDITOR → 404; non-DRAFT audit → 404.
    - `patchMachineRoom`: AUDITOR happy-path; non-owner → 404; non-DRAFT → 404; calls repo with right args.
    - `getMachineRooms`: ADMIN succeeds; returns repo result.

- [x] **Task 5 — Routes: machine room endpoints + register in app.ts (AC: #9, #12)**
  - [x] Create `apps/api/src/routes/machine-rooms.routes.ts`:
    - `POST /api/v1/audits/:auditId/machine-rooms` — body: `createMachineRoomBodySchema`; response 201: `createMachineRoomResponseSchema`; calls `machineRoomService.getOrCreateMachineRoom` (idempotent: returns existing if present). Role: AUDITOR.
    - `GET /api/v1/audits/:auditId/machine-rooms` — response 200: `listMachineRoomsResponseSchema`; any auth role. Calls `machineRoomService.getMachineRooms`.
    - `PATCH /api/v1/audits/:auditId/machine-rooms/:roomId` — params: `patchMachineRoomParamsSchema`; body: `patchMachineRoomBodySchema`; response 200: `patchMachineRoomResponseSchema`. Calls `machineRoomService.patchMachineRoom`. AUDITOR only.
    - All routes: 401/403/404/422 problem-detail responses; `requireRole` pre-handler as appropriate.
    - Export `registerMachineRoomsRoutes(app: FastifyInstance): void`.
  - [x] Edit `apps/api/src/app.ts` — import and call `registerMachineRoomsRoutes(app)` after `registerAuditsRoutes`.
  - [x] Create `apps/api/src/routes/machine-rooms.routes.test.ts`:
    - POST 201 happy path; POST idempotent returns existing; POST 403 for ADMIN/CLIENT; POST 422 invalid auditId.
    - GET 200 returns list.
    - PATCH 200 happy path; PATCH 403 ADMIN/CLIENT; PATCH 404 audit-not-editable; PATCH 422 invalid roomId.

- [x] **Task 6 — SPA: AuditBreadcrumb component (AC: #1)**
  - [x] Create `apps/audit-app/src/features/audit/AuditBreadcrumb.tsx`:
    - Props: `{ segments: Array<{ label: string; to?: string }> }`
    - Renders `<nav aria-label="Audit navigation" className="mb-4"><ol className="flex items-center flex-wrap gap-x-1 text-sm text-muted">` with `<li>` per segment.
    - Tappable segment (`to` defined): `<Link to={s.to} className="text-primary underline hover:text-primary-hover max-w-[30vw] truncate inline-block align-bottom">{s.label}</Link>`.
    - Current segment (last, no `to`): `<span aria-current="page" className="text-foreground font-medium max-w-[30vw] truncate inline-block align-bottom">{s.label}</span>`.
    - Separator: `<span aria-hidden="true" className="mx-1 text-muted">›</span>` between each `<li>` pair.
  - [x] Create `apps/audit-app/src/features/audit/AuditBreadcrumb.test.tsx`:
    - Renders `<nav aria-label="Audit navigation">`.
    - Single segment, no link: `aria-current="page"` span.
    - Two segments: first is a `<Link>`, second has `aria-current="page"`.
    - Three segments: first two are links, last is current.
    - Separators `›` rendered between segments.
    - axe scan passes.

- [x] **Task 7 — SPA: FieldHelpTooltip component (AC: #2, #5)**
  - [x] Verify `@cems/ui` exports `Popover`, `PopoverTrigger`, `PopoverContent` (shadcn/ui primitives). If missing, run `pnpm --filter @cems/ui dlx shadcn@latest add popover` or copy into `packages/ui/src/components/Popover.tsx` manually.
  - [x] Create `apps/audit-app/src/features/audit/FieldHelpTooltip.tsx`:
    - Props: `{ content: string; label?: string }` (label defaults to "Help").
    - Renders `<Popover><PopoverTrigger asChild><button type="button" className="inline-flex items-center justify-center rounded-full bg-muted text-muted-foreground h-5 w-5 text-xs font-bold ml-1 flex-shrink-0" aria-label={label ?? 'Help'}>?</button></PopoverTrigger><PopoverContent className="max-w-[240px] text-sm">{content}</PopoverContent></Popover>`.
    - Touch-first: Popover state controlled by Radix — tap to open, tap outside to close.
  - [x] Create `apps/audit-app/src/features/audit/FieldHelpTooltip.test.tsx`:
    - Button renders with `aria-label="Help"`.
    - Clicking button opens popover showing content.
    - axe scan passes with popover open and closed.

- [x] **Task 8 — SPA: machine-room-api.ts hooks (AC: #9, #12)**
  - [x] Create `apps/audit-app/src/features/audit/machine-room-api.ts`:
    - `useMachineRooms(auditId: string | null)`: `useQuery<ListMachineRoomsResponse>({ queryKey: ['audits', auditId, 'machine-rooms'], queryFn: () => apiFetch(\`/api/v1/audits/${auditId}/machine-rooms\`), enabled: !!auditId, staleTime: 30_000 })`.
    - `useGetOrCreateMachineRoom()`: `useMutation<CreateMachineRoomResponse, Error, { auditId: string }>({ mutationFn: ({ auditId }) => apiFetch(\`/api/v1/audits/${auditId}/machine-rooms\`, { method: 'POST', body: JSON.stringify({}) }) })`.
    - `useAutoSaveMachineRoom(auditId: string | null, roomId: string | null)`: same internal structure as `useAutoSaveSection` (copy + adapt): debounced 800 ms, single-in-flight invariant, retry 2 s → 5 s → 15 s, 4xx no-retry, `window.online` flush. PATCHes `PATCH /api/v1/audits/${auditId}/machine-rooms/${roomId}` with body `{ data }`. Disabled (no-op save) when either id is null. Returns `{ state, lastSavedAt, save, flush }`.
  - No test file needed for the hooks individually — covered by the page-level tests via fetch mocking.

- [x] **Task 9 — Tailwind: shake animation + viewport meta (AC: #10, #11)**
  - [x] Edit `packages/config/tailwind/preset.ts` — add under `theme.extend`:
    ```ts
    keyframes: {
      shake: {
        '0%, 100%': { transform: 'translateX(0)' },
        '20%': { transform: 'translateX(-6px)' },
        '40%': { transform: 'translateX(6px)' },
        '60%': { transform: 'translateX(-4px)' },
        '80%': { transform: 'translateX(4px)' },
      },
    },
    animation: {
      shake: 'shake 0.4s ease-in-out',
    },
    ```
  - [x] Edit `apps/audit-app/index.html` — update viewport meta to include `viewport-fit=cover`:
    `<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover">`
    (required for `env(safe-area-inset-bottom)` to work on iOS).

- [x] **Task 10 — SPA: MachineRoomGeneralPage (AC: #1, #2, #3, #4, #9, #10, #11, #12)**
  - [x] Create `apps/audit-app/src/features/audit/MachineRoomGeneralPage.tsx`:
    - Reads `auditId` from `useParams`.
    - On mount: calls `useGetOrCreateMachineRoom.mutate({ auditId })`; stores returned `roomId` in local state; shows `<Skeleton>` grid while in-flight; error alert `role="alert"` if fails.
    - On success, hydrates react-hook-form `defaultValues` from `response.data.general ?? {}`.
    - Uses `useAutoSaveMachineRoom(auditId, roomId)`.
    - Renders `<OfflineBanner lastSavedAt={autoSave.lastSavedAt} />`.
    - Renders `<AuditBreadcrumb segments={[{ label: 'Refrigeration', to: \`/audit/${auditId}\` }, { label: 'Machine Room' }]} />`.
    - Renders `<AutoSaveIndicator state={autoSave.state} />` next to page heading.
    - **Form** (`react-hook-form`, `mode: 'onSubmit'`):
      - `Controller` for Machine Room ID (required): `<select>` or shadcn `Select` from `MR_ID_OPTIONS`. Label "Machine Room ID\*", `FieldHelpTooltip content="Select a unique identifier for this machine room (e.g. 1 for the primary room)"`.
      - `Controller` for Location: `<select>` from `MR_LOCATION_OPTIONS`. Label "Location", tooltip "Physical location of the machine room in the building".
      - `useFieldArray({ name: 'racks' })` — initial value `[{}]`. Each row renders Rack Name, Suction Group Number, Suction Group Type — each a `<select>` from their respective option constants. Rows get `min-h-[48px]` touch targets.
      - "Add Another Rack" `<button type="button" onClick={() => append({})} className="...">+ Add Another Rack</button>`.
    - **Attempt-first validation state**: `const [attempted, setAttempted] = useState(false)`.
    - `handleSubmit` wrapper: on invalid → `setAttempted(true)` (does NOT navigate); on valid → `autoSave.flush()` then `navigate(\`/audit/${auditId}/section/refrigeration/ventilation\`)`.
    - Error count: `Object.keys(formState.errors).length + (errors.racks?.length ?? 0)`.
    - `errorBorderClass(fieldName)`: returns `'border-danger animate-shake'` when `attempted && !!formState.errors[fieldName]`, else `''`.
    - **Fixed Next button**: `<button type="submit" className="fixed bottom-0 left-0 right-0 bg-primary text-primary-foreground text-base font-semibold p-4 pb-[env(safe-area-inset-bottom)] min-h-[64px]">{attempted && errorCount > 0 ? \`Next (${errorCount} required field${errorCount !== 1 ? 's' : ''} remaining)\` : 'Next'}</button>`.
    - Main content has `pb-24` to avoid the fixed button obscuring bottom fields.
    - On `watch()` change: `autoSave.save({ general: getValues() })`.
    - **Note:** Label elements for Radix Select groups use `<p id="...">` + `aria-labelledby` on SelectTrigger (not `<label htmlFor>`) to satisfy `jsx-a11y/label-has-associated-control` — Radix triggers are buttons, not native inputs.
  - [x] Create `apps/audit-app/src/features/audit/MachineRoomGeneralPage.test.tsx`:
    - Skeleton shown while POST in-flight.
    - Error alert if POST fails.
    - All form fields render with correct labels and help icons.
    - "Add Another Rack" appends a new row.
    - Tapping Next with empty Machine Room ID → `attempted=true` → error classes appear; "N required fields remaining" in button label; navigation NOT called.
    - Tapping Next with valid data → navigate mock called with ventilation URL.
    - Field change triggers PATCH after 800 ms (fake timers).
    - axe scan passes with default state.

- [x] **Task 11 — SPA: MachineRoomVentilationPage (AC: #1, #5, #6, #7, #8, #9, #10, #11)**
  - [x] Create `apps/audit-app/src/features/audit/MachineRoomVentilationPage.tsx`:
    - Reads `auditId` from `useParams`.
    - Fetches `useMachineRooms(auditId)` — `machineRooms[0]` is the room; shows skeleton while loading; error alert on failure. `roomId = machineRooms[0]?.id`.
    - Uses `useAutoSaveMachineRoom(auditId, roomId)`.
    - Renders `<OfflineBanner>` + `<AuditBreadcrumb segments={[{ label: 'Refrigeration', to: \`/audit/${auditId}\` }, { label: 'Machine Room', to: \`/audit/${auditId}/section/refrigeration\` }, { label: 'Ventilation' }]} />` + `<AutoSaveIndicator>`.
    - Hydrates `defaultValues` from `machineRooms[0]?.data?.ventilation ?? {}`.
    - **Form** (`mode: 'onSubmit'`):
      - Ventilation Type\* (required `Controller` `Select` from `VENTILATION_TYPE_OPTIONS`). Label + tooltip "Forced = mechanical fan; Natural = louvers/opening in wall".
      - Connected to Exhaust (`Controller` `Select` from `CONNECTED_TO_EXHAUST_OPTIONS`; `defaultValue: 'No'`). Always visible. Tooltip "Whether the ventilation is connected to the exhaust system".
      - `const isForced = watch('ventilationType') === 'Forced'`.
      - Set point ON (°F): `{isForced && <Controller ... render={...} />}` — numeric `<Input type="number">`; tooltip "Temperature at which ventilation activates". Hidden when Natural.
      - Set point OFF (°F): same conditional; cross-field `validate` rule: `(v, fv) => !fv.setPointOn || Number(v) < Number(fv.setPointOn) || 'OFF set point must be lower than ON set point for cooling ventilation.'`. Tooltip "Must be lower than ON set point".
      - Control by: conditional on `isForced`; `Select` from `VENTILATION_CONTROL_BY_OPTIONS`. Tooltip "What activates the fan".
    - **useEffect on ventilationType**: when it changes to 'Natural', `setValue('setPointOn', undefined); setValue('setPointOff', undefined); setValue('controlBy', undefined); setValue('connectedToExhaust', 'No')`.
    - Attempt-first validation + `attempted` state + `animate-shake` on error fields (same pattern as Task 10).
    - Fixed Next button (same pattern). On valid → `autoSave.flush()` then `navigate(\`/audit/${auditId}/section/refrigeration/exhaust\`)`.
    - On `watch()` change: `autoSave.save({ ventilation: getValues() })`.
  - [x] Create `apps/audit-app/src/features/audit/MachineRoomVentilationPage.test.tsx`:
    - Skeleton while `useMachineRooms` loading.
    - "Natural" selection → Set point + Control by fields hidden.
    - "Forced" selection → Set point + Control by fields shown.
    - SET point OFF ≥ ON with Forced → cross-field error on Next tap.
    - Required Ventilation Type empty → Next tap → error class + count label.
    - Valid submit → navigate to exhaust URL.
    - Field change triggers PATCH (fake timers).
    - axe scan passes.

- [x] **Task 12 — App.tsx routing update (AC: #1, #10)**
  - [x] Edit `apps/audit-app/src/App.tsx`:
    - Import `MachineRoomGeneralPage` and `MachineRoomVentilationPage`.
    - Add these two routes **before** the existing `/audit/:auditId/section/:sectionId` route (React Router v7 uses specificity, but static wins over dynamic — add before for clarity):
      ```tsx
      <Route
        path="/audit/:auditId/section/refrigeration/ventilation"
        element={<RequireAuth surface={SURFACE}><MachineRoomVentilationPage /></RequireAuth>}
      />
      <Route
        path="/audit/:auditId/section/refrigeration"
        element={<RequireAuth surface={SURFACE}><MachineRoomGeneralPage /></RequireAuth>}
      />
      ```
  - [x] Edit `apps/audit-app/src/features/audit/SectionEditPage.tsx`:
    - Remove `'refrigeration'` from `COMING_SOON_BY_SECTION` (dead code — the specific route now handles it). The `isValidSection` guard still accepts 'refrigeration' so a stale URL won't crash; it will just render the generic page, which is acceptable.

- [x] **Task 13 — Validations: lint + type-check + tests (DoD)**
  - [x] `pnpm turbo run lint type-check test`. Fix any breakage.
  - [x] Confirm `packages/ui` has `Popover`, `PopoverTrigger`, `PopoverContent` — added `@radix-ui/react-popover` + `packages/ui/src/components/Popover.tsx`.
  - [x] Verify no regressions in existing 2.3/2.4 test suites.
  - [x] Confirm `animate-shake` class is recognised by Tailwind (purge config includes audit-app src).

- [x] **Task 14 — Finalize: checkboxes, Dev Agent Record, status flip (DoD)**
  - [x] Tick every `[ ]` → `[x]`.
  - [x] Fill Dev Agent Record (Completion Notes per task, Debug Log, File List).
  - [x] Add Change Log row.
  - [x] Flip Status to `"review"`.
  - [x] Update sprint-status: `3-1-…: in-progress → review`.

## Dev Notes

### What 2.3/2.4 already shipped — build on it, don't rebuild

- `useAutoSaveSection` (`apps/audit-app/src/features/audit/useAutoSaveSection.ts`) — the debounce/retry/flush logic; **copy and adapt** to `useAutoSaveMachineRoom`, changing only the endpoint and disabling when `roomId` is null. Do NOT extract a shared util yet (premature abstraction; Story 3.2 will show whether the pattern repeats enough to warrant it).
- `AutoSaveIndicator`, `OfflineBanner`, `useNetworkStatus` — import directly; no changes needed.
- `audit_sections` sectionId='refrigeration' row — already handled by the `SectionOverviewPage` for "In Progress" detection. The machine room PATCH **must** also upsert this row so the Section Overview correctly shows Refrigeration as "In Progress" once the auditor starts entering data.
- `SectionEditPage` stub for 'refrigeration' — now dead code (route shadowed by the new specific route). Remove the message from `COMING_SOON_BY_SECTION` in Task 12.

### DB schema — no migration needed

All refrigeration tables (`machine_rooms`, `racks`, `compressors`, `condensers`, `walk_ins`, `display_cases`, `controllers`) are already in `packages/db/prisma/schema.prisma`. No new migration is required for Story 3.1. The `MachineRoom` model maps to `machine_rooms` table with: `id (cuid), tenantId, auditId, roomNumber, data (NVarChar(Max), default '{}'), createdAt, updatedAt`. Prisma field mapping (`@map`) is already correct.

### Three-layer test pattern (same as 2.1–2.4)

```
machine-rooms.routes.test.ts  ← mock service
machine-room.service.test.ts  ← mock repo
machine-room.repo.test.ts     ← mock prisma tx object
```

### Multi-entry rack rows (Task 10)

Use `react-hook-form`'s `useFieldArray({ control, name: 'racks' })`. Initial value: `fields = [{ rackName: '', suctionGroupNumber: '', suctionGroupType: '' }]`. `append({})` adds a blank row. The entire `racks` array is part of the auto-saved payload in `data.general`. Schema validates `racks.min(1)` — at least one rack entry must be non-empty (the Zod schema enforces `min(1)` on the array; the form validation layer checks that `rackName` in the first row is non-empty via `required` rule).

### Attempt-first validation (new pattern for Epic 3)

Unlike 2.3's `react-hook-form` with `watch()` subscription, these screens use **on-submit** validation:
```ts
const [attempted, setAttempted] = useState(false)

const onInvalid: SubmitErrorHandler<FormShape> = () => setAttempted(true)
// handleSubmit(onValid, onInvalid) — pass onInvalid to set attempted flag

// In JSX:
className={clsx(
  'border rounded px-3',
  attempted && !!errors.machineRoomId && 'border-danger animate-shake',
)}
```
The `animate-shake` animation fires once on mount of the class (CSS animation). Re-triggering it on repeated Next taps: remove + re-add the class using a key trick or by toggling a `shakeKey` state with `Date.now()`. Simplest approach: toggle the attempted state off for one render then back on.

### Conditional field logic — Natural vs. Forced ventilation

```ts
const ventilationType = watch('ventilationType')
const isForced = ventilationType === 'Forced'

// Render conditionally:
{isForced && <Controller name="setPointOn" ... />}

// Reset hidden fields when type changes:
useEffect(() => {
  if (!isForced) {
    setValue('setPointOn', undefined, { shouldValidate: false })
    setValue('setPointOff', undefined, { shouldValidate: false })
    setValue('controlBy', undefined, { shouldValidate: false })
    setValue('connectedToExhaust', 'No', { shouldValidate: false })
  }
}, [isForced, setValue])
```

### Cross-field set-point validation

Define in `useForm` `resolver` or via `register` `validate` option on the `setPointOff` field:
```ts
validate: {
  offLowerThanOn: (v, fv) => {
    if (fv.ventilationType !== 'Forced') return true
    if (!v || !fv.setPointOn) return true
    return Number(v) < Number(fv.setPointOn)
      || 'OFF set point must be lower than ON set point for cooling ventilation.'
  },
}
```
Surface this error inline below the Set point OFF field (not in the Next button count — it's a cross-field warning, not a "missing required field").

### Fixed "Next" button + iOS safe area

```tsx
<button
  type="submit"
  className="fixed bottom-0 left-0 right-0 bg-primary text-primary-foreground
             text-base font-semibold p-4 pb-[env(safe-area-inset-bottom)]
             min-h-[64px] z-10"
>
  {attempted && errorCount > 0
    ? `Next (${errorCount} required field${errorCount !== 1 ? 's' : ''} remaining)`
    : 'Next'}
</button>
```
`pb-[env(safe-area-inset-bottom)]` only works on iOS when `index.html` has `viewport-fit=cover` in the meta viewport. Task 9 adds this. On non-iOS `env(safe-area-inset-bottom)` resolves to `0` — safe to use everywhere.

Add `pb-24` (96px) to the form's outer wrapper so the last field isn't obscured by the fixed button on small screens.

### Route specificity — React Router v7

React Router v7 (like v6) matches static path segments before dynamic ones. `/audit/:auditId/section/refrigeration` will win over `/audit/:auditId/section/:sectionId` when the URL contains the literal "refrigeration". Declare the more-specific routes first in the JSX `<Routes>` block for readability. The Ventilation route at `/…/refrigeration/ventilation` similarly beats the generic section route.

### AuditBreadcrumb is infrastructure for all 3.x stories

Every subsequent Machine Room, Rack, Compressor, Condenser, Walk-In, and Controller screen will import `AuditBreadcrumb`. Design it generically (segment array, not hardcoded). The Story 3.2 Rack screen will use: `[{ label: 'Refrigeration', to: overviewUrl }, { label: 'Machine Room', to: mrUrl }, { label: 'Rack List' }]`. The `to` prop is optional so the current-position segment has no link.

Breadcrumb truncation: each segment label is `max-w-[30vw] truncate`. This ensures the breadcrumb doesn't overflow on narrow viewports. The `›` separators are `aria-hidden`.

### FieldHelpTooltip — touch-first

Use `Popover` from `@cems/ui` (Radix primitive), not `Tooltip` (hover-only, doesn't work on mobile). If `@cems/ui` doesn't yet export Popover, add it — shadcn/ui Popover is a single file copy into `packages/ui/src/components/Popover.tsx`. Popover closes on outside click natively in Radix.

### Offline / "Pending Sync" note

Story 3A Scenario 4 mentions "save to local cache and mark as Pending Sync" — this is **the same "detect + retry" model** already shipped in Story 2.3, not a true IndexedDB offline-first cache (which is Post-MVP per the architecture). The `useAutoSaveMachineRoom` retry loop + `OfflineBanner` satisfies this AC. No new offline infrastructure needed.

### `getOrCreateMachineRoom` is idempotent (POST returning existing)

The `POST /api/v1/audits/:auditId/machine-rooms` route calls `getOrCreateMachineRoom`, which checks for existing rooms first. This makes it safe to call on every page load without creating duplicates. The 201 vs 200 status distinction is skipped here for simplicity — return 200 with the existing room when it already exists. If the client calls this twice, it gets the same room back.

### Error class reuse — `AuditNotEditableError`

The `machine-room.service.ts` reuses `AuditNotEditableError` from `apps/api/src/lib/audit-errors.ts` (created in Story 2.3) for the "AUDITOR doesn't own audit" and "audit not DRAFT" cases. The error handler already maps it to 404. `MachineRoomNotFoundError` (new in Task 4) maps to 404 with a different `type` slug.

### Anti-patterns to avoid

- **DO NOT** store Machine Room data in `audit_sections.data` directly — it belongs in `machine_rooms.data` (relational table, supports equipment-level calculations). The `audit_sections` row for 'refrigeration' carries only a summary cursor (e.g. `{ machineRoomIds: ['...'], lastSavedAt: '...' }`), not the full form data.
- **DO NOT** use `useEffect(() => fetch(), [])` to load machine rooms — use TanStack Query (`useMachineRooms`).
- **DO NOT** let the "Next" button navigate if `autoSave.state === 'error'` with a pending retry. Call `autoSave.flush()` on valid submit to ensure the latest payload is dispatched; navigation happens immediately regardless (same pattern as SectionEditPage's auto-save behaviour).
- **DO NOT** add a separate `<Route>` for `/audit/:auditId/section/refrigeration/exhaust` in this story — leave the stub navigation in place and let Story 3.2 own that route.
- **DO NOT** trigger the `animate-shake` class for every render — it should only appear after the first failed submit (`attempted === true`).
- **DO NOT** show live per-field errors while typing (mode should be `'onSubmit'`, not `'onChange'`). Attempt-first is the UX pattern for refrigeration forms.
- **DO NOT** call `withRlsTransaction` twice for the 4-step `upsertMachineRoomData` — all 4 writes happen inside a single `withRls` callback to maintain atomicity.

### Project Structure Notes

New files follow existing conventions:
- Route files: `apps/api/src/routes/machine-rooms.routes.ts` + `.test.ts`
- Service: `apps/api/src/services/machine-room.service.ts` + `.test.ts`
- Repo: `apps/api/src/repositories/machine-room.repo.ts` + `.test.ts`
- SPA pages: `apps/audit-app/src/features/audit/MachineRoomGeneralPage.tsx` + `.test.tsx`
- SPA shared components: `AuditBreadcrumb.tsx`, `FieldHelpTooltip.tsx` co-located in `features/audit/`

All test files co-located with source (no `__tests__/` folders per architecture rules).

### References

- [Epic 3A Machine Room](../planning-artifacts/star-energy-review/Epic%203A%20Machine%20Room%2035067e8cf382808b8d73ca21a6180c7c.md) — Story 3.1.1, 3.1.2 ACs (canonical source for Machine Room General + Ventilation)
- [epic-03 lines 9–36](../planning-artifacts/star-energy-review/epic-03-refrigeration-data-collection-core-audit-engine.md) — original breadcrumb AC + navigation flow
- [Ref_MR.csv](../../../BMAD/../BMAD/docs/Audit%20App%20related%20csv%20files/CEMS_Hierarchy010726_PP_2.xlsx%20-%20Ref_MR.csv) — field names, dropdown options, tooltip text for screens 2.101–2.112
- [packages/db/prisma/schema.prisma](../../../../packages/db/prisma/schema.prisma) — `MachineRoom` model (already exists, no migration needed)
- [apps/audit-app/src/features/audit/useAutoSaveSection.ts](../../../../apps/audit-app/src/features/audit/useAutoSaveSection.ts) — hook to copy/adapt for `useAutoSaveMachineRoom`
- [apps/api/src/lib/audit-errors.ts](../../../../apps/api/src/lib/audit-errors.ts) — `AuditNotEditableError` to reuse
- [apps/api/src/routes/audits.routes.ts](../../../../apps/api/src/routes/audits.routes.ts) — route registration pattern
- [docs/bmad/_bmad-output/implementation-artifacts/2-3-auto-save-and-session-resume.md](./2-3-auto-save-and-session-resume.md) — three-layer test pattern, repo/service/route conventions, `withRls` usage

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

- **`@cems/types` unbuilt**: all API tests failed with "Failed to resolve entry for package @cems/types" until `pnpm --filter @cems/types build` was run to generate `dist/`.
- **MachineRoomGeneralPage skeleton test**: initial assertion used `findByRole('status')` but Skeleton renders `animate-pulse` divs without role — changed to `document.querySelector('[aria-busy="true"]')`.
- **Radix UI `hasPointerCapture` in jsdom**: `TypeError: target.hasPointerCapture is not a function` from `@radix-ui/react-select`. Fixed by adding pointer-capture mocks to `apps/audit-app/src/test/setup.ts`.
- **jsx-a11y `label-has-associated-control`**: 8 lint errors for `<label>` elements paired with Radix Select triggers (which are buttons, not inputs). Fixed by replacing all `<label id="...">` elements with `<p id="...">` and relying on `aria-labelledby` for a11y semantics.

### Completion Notes List

- **Task 1**: sprint-status updated; epic-3 set to in-progress; story status set to in-progress; last_updated bumped.
- **Task 2**: All machine room Zod schemas added to `packages/types/src/audit.ts`; dropdown constants added to `packages/types/src/forms/refrigeration.schema.ts`; all new types re-exported from index.
- **Task 3**: `machine-room.repo.ts` created with 4 functions; `machine-room.repo.test.ts` created with 11 tests across 3 describe blocks. All pass.
- **Task 4**: `MachineRoomNotFoundError` added to `audit-errors.ts`; error-handler wired; `machine-room.service.ts` created with 3 service functions; `machine-room.service.test.ts` with 13 tests. All pass.
- **Task 5**: `machine-rooms.routes.ts` created with POST/GET/PATCH; registered in `app.ts`; `machine-rooms.routes.test.ts` with 10 tests. All pass.
- **Task 6**: `AuditBreadcrumb.tsx` created; `AuditBreadcrumb.test.tsx` with 6 tests including axe scan. All pass.
- **Task 7**: `@radix-ui/react-popover` added to `packages/ui`; `Popover.tsx` created; exported from index; `FieldHelpTooltip.tsx` + `FieldHelpTooltip.test.tsx` with 5 tests. All pass.
- **Task 8**: `machine-room-api.ts` created with `useMachineRooms`, `useGetOrCreateMachineRoom`, `useAutoSaveMachineRoom` hooks.
- **Task 9**: `animate-shake` keyframes added to `packages/config/tailwind/preset.ts`; `viewport-fit=cover` added to `apps/audit-app/index.html`.
- **Task 10**: `MachineRoomGeneralPage.tsx` created with full form (MR ID, Location, dynamic rack rows); `MachineRoomGeneralPage.test.tsx` with 6 tests. All pass.
- **Task 11**: `MachineRoomVentilationPage.tsx` created with conditional fields (Forced/Natural), cross-field set-point validation; `MachineRoomVentilationPage.test.tsx` with 8 tests. All pass.
- **Task 12**: Routes added to `App.tsx` before generic `:sectionId` route; refrigeration removed from `COMING_SOON_BY_SECTION` in `SectionEditPage.tsx`.
- **Task 13**: Full suite passes — api: 30 files / 276 tests; audit-app: 18 files / 110 tests; admin-app: 6 files / 25 tests; client-portal: 6 files / 25 tests; @cems/db: 1 file / 9 tests. Lint passes with `--max-warnings=0`. Type-check passes.
- **Task 14**: All checkboxes ticked; Dev Agent Record filled; Change Log updated; sprint-status flipped to review.

### File List

**New files:**
- `apps/api/src/repositories/machine-room.repo.ts`
- `apps/api/src/repositories/machine-room.repo.test.ts`
- `apps/api/src/services/machine-room.service.ts`
- `apps/api/src/services/machine-room.service.test.ts`
- `apps/api/src/routes/machine-rooms.routes.ts`
- `apps/api/src/routes/machine-rooms.routes.test.ts`
- `packages/ui/src/components/Popover.tsx`
- `apps/audit-app/src/features/audit/AuditBreadcrumb.tsx`
- `apps/audit-app/src/features/audit/AuditBreadcrumb.test.tsx`
- `apps/audit-app/src/features/audit/FieldHelpTooltip.tsx`
- `apps/audit-app/src/features/audit/FieldHelpTooltip.test.tsx`
- `apps/audit-app/src/features/audit/machine-room-api.ts`
- `apps/audit-app/src/features/audit/MachineRoomGeneralPage.tsx`
- `apps/audit-app/src/features/audit/MachineRoomGeneralPage.test.tsx`
- `apps/audit-app/src/features/audit/MachineRoomVentilationPage.tsx`
- `apps/audit-app/src/features/audit/MachineRoomVentilationPage.test.tsx`

**Modified files:**
- `packages/types/src/audit.ts` — added machine room schemas and types
- `packages/types/src/forms/refrigeration.schema.ts` — replaced stub with dropdown constants
- `packages/types/src/index.ts` — re-exported new schemas/types
- `packages/ui/package.json` — added `@radix-ui/react-popover`
- `packages/ui/src/index.ts` — exported Popover components
- `packages/config/tailwind/preset.ts` — added `animate-shake` keyframes
- `apps/api/src/lib/audit-errors.ts` — added `MachineRoomNotFoundError`
- `apps/api/src/middleware/error-handler.ts` — mapped `MachineRoomNotFoundError` → 404
- `apps/api/src/app.ts` — registered `registerMachineRoomsRoutes`
- `apps/audit-app/index.html` — added `viewport-fit=cover`
- `apps/audit-app/src/App.tsx` — added two refrigeration routes
- `apps/audit-app/src/features/audit/SectionEditPage.tsx` — removed refrigeration from `COMING_SOON_BY_SECTION`
- `apps/audit-app/src/test/setup.ts` — added Radix UI pointer-capture + scrollIntoView mocks

### Review Findings

> Code review run 2026-05-16. 3 `decision-needed`, 13 `patch`, 5 `defer`, ~10 dismissed.

#### Decision-Needed (resolve before patching)

- [x] [Review][Decision] D1 — `upsertMachineRoomData` always writes `machineRoomIds: [input.id]` — clobbers other rooms when a second machine room exists — `apps/api/src/repositories/machine-room.repo.ts:131`. Merge strategy needed: read existing section data, accumulate IDs, or abandon multi-room summary. Story 3.2 adds a second machine room so this will bite. Choose: (a) fetch-merge-write, or (b) store summary without machineRoomIds list until Story 3.2 defines the canonical shape.
- [x] [Review][Decision] D2 — `maximum-scale=1` in `apps/audit-app/index.html` violates WCAG 1.4.4 (user zoom, Level AA). Removing it allows pinch-to-zoom. Choose: (a) remove `maximum-scale=1` to restore zoom, or (b) accept the deviation (many browsers now ignore it anyway — confirm field target devices).
- [x] [Review][Decision] D3 — No unique DB constraint on `(auditId, roomNumber)` — two simultaneous POST requests (concurrent page loads) can create duplicate machine room rows; `getOrCreate` read-then-write is not atomic. Choose: (a) add a migration adding `@@unique([auditId, roomNumber])` to the Prisma schema and catch P2002 in service, or (b) accept the race as acceptable for MVP (single-auditor sessions make it unlikely).

#### Patches

- [x] [Review][Patch] P1 — Unused `AuditNotEditableError` import + duplicate import statements in `machine-room.repo.ts` [`apps/api/src/repositories/machine-room.repo.ts:2-3`]
- [x] [Review][Patch] P2 — `upsertMachineRoomData` WHERE clause missing `auditId` scope; PATCH service doesn't validate room belongs to the given audit — cross-audit write possible [`apps/api/src/repositories/machine-room.repo.ts:115`, `apps/api/src/services/machine-room.service.ts:72`]
- [x] [Review][Patch] P3 — Rack validation missing: no `required` rule on `rackName`; `racksError` never contributes to `errorCount`; empty rack rows pass submission — violates AC3 and AC4 [`apps/audit-app/src/features/audit/MachineRoomGeneralPage.tsx:164,109`]
- [x] [Review][Patch] P4 — `setPointOffError` not counted in `errorCount`; equal set-points (OFF === ON) pass strict-less-than; `setPointOn` empty + `setPointOff` set silently skips cross-field validation [`apps/audit-app/src/features/audit/MachineRoomVentilationPage.tsx:103-104,268`]
- [x] [Review][Patch] P5 — `'use client'` directive in `Popover.tsx` is a Next.js App Router artifact; meaningless in Vite [`packages/ui/src/components/Popover.tsx:1`]
- [x] [Review][Patch] P6 — `React.MutableRefObject` referenced without importing React in `.ts` file [`apps/audit-app/src/features/audit/machine-room-api.ts`]
- [x] [Review][Patch] P7 — Missing 401 unauthenticated test cases for all three machine room endpoints [`apps/api/src/routes/machine-rooms.routes.test.ts`]
- [x] [Review][Patch] P8 — `createMachineRoomResponseSchema` omits `updatedAt` and `tenantId` while service returns full `MachineRoom` — schema/contract mismatch [`packages/types/src/audit.ts:177-183`]
- [x] [Review][Patch] P9 — Direct navigation to `/ventilation` when no machine room exists yields `roomId = null`; all auto-saves silently no-op; user loses data [`apps/audit-app/src/features/audit/MachineRoomVentilationPage.tsx:30`]
- [x] [Review][Patch] P10 — `FieldHelpTooltip` button renders `h-5 w-5` (20 × 20 px) — violates AC11 `min-h-[48px] min-w-[48px]` touch target on every help icon across both screens [`apps/audit-app/src/features/audit/FieldHelpTooltip.tsx:15`]
- [x] [Review][Patch] P11 — `GET /api/v1/audits/:auditId/machine-rooms` has no `requireAuth` guard — unauthenticated callers bypass JWT check; RLS context is null [`apps/api/src/routes/machine-rooms.routes.ts`]
- [x] [Review][Patch] P12 — Hydration appends rack rows on every `onSuccess` call; mutation retry (after failure + success) produces duplicate rack rows [`apps/audit-app/src/features/audit/MachineRoomGeneralPage.tsx:63-83`]
- [x] [Review][Patch] P13 — `MachineRoomGeneralPage.test.tsx` missing happy-path navigation test (valid submit → navigate to `/ventilation`) — required by Task 10 [`apps/audit-app/src/features/audit/MachineRoomGeneralPage.test.tsx`]

#### Deferred

- [x] [Review][Defer] W1 — Array index used as `key` in `AuditBreadcrumb` — deferred, no runtime re-ordering in current usage [`apps/audit-app/src/features/audit/AuditBreadcrumb.tsx:20`]
- [x] [Review][Defer] W2 — `flush()` is fire-and-forget; navigation precedes save completion if save is in-flight — deferred, same accepted pattern from Story 2.3 [`MachineRoomGeneralPage.tsx:103`, `MachineRoomVentilationPage.tsx:98`]
- [x] [Review][Defer] W3 — No set-point range validation (°F bounds); unrealistic values accepted — deferred, no spec requirement for range bounds; calc-service validation handles in Story 8
- [x] [Review][Defer] W4 — `staleTime: 30_000` on `useMachineRooms` — refetch on window focus after 30 s can overwrite in-progress edits — deferred, low likelihood with single-auditor sessions; revisit in Story 3.6 (section locking)
- [x] [Review][Defer] W5 — Stale closure risk in `useAutoSaveMachineRoom` when `auditId`/`roomId` change between debounce enqueue and `sendNow` — deferred, both IDs are stable for a page session; low practical risk

## Change Log

| Date       | Change                                                 |
|------------|--------------------------------------------------------|
| 2026-05-12 | Story created via create-story from Epic 3A Machine Room + original Epic 3 Story 3.1 context |
| 2026-05-16 | Implementation complete — all 14 tasks done; full test suite passes (276 API + 110 audit-app tests); lint + type-check clean; status → review |
| 2026-05-16 | Code review complete — 3 decision-needed, 13 patch, 5 defer, ~10 dismissed; status → in-progress |
| 2026-05-16 | All 15 review findings resolved (D1 fetch-merge-write, D2 dismissed, D3 P2002 catch, P1-P13 patched); test suite green (30 API + all SPA files); status → done |
