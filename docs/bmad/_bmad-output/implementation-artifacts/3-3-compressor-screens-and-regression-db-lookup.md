# Story 3.3: Compressor Screens & Regression DB Lookup

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a Field Energy Auditor,
I want compressor nameplate data to auto-populate from the Star Energy regression database when I enter a model number — and to enter specs manually (with the Admin notified) when the model isn't found —
so that known compressors require minimal on-site typing and unknown compressors are still captured accurately and flagged for the central database.

**Source:** `epic-03-refrigeration-data-collection-core-audit-engine.md` Story 3.3 ACs. Covers FR3, FR4 (refrigeration), FR7, FR45, FR53. Continues the guided refrigeration flow from Story 3.2 (Rack General → Compressors).

**Scope — what this story ships:**
- **Compressor regression-DB lookup endpoint** — `GET /api/v1/compressors/:model` against the GLOBAL `compressor_refs` table (no RLS — see Dev Notes). Returns the matched `CompressorRef` or `404`.
- **Compressor entity API** — `POST / GET / GET / PATCH / duplicate` + `report-unknown-model` under `/api/v1/audits/:auditId/machine-rooms/:roomId/racks/:rackId/compressors[/:compressorId]`. The `Compressor` table already exists in the Prisma schema — **no new migration needed**.
- **Compressor List screen** (`/audit/:auditId/section/refrigeration/rack/:rackId/compressors`) — lists all compressors for a rack with completion status, "Add Compressor", per-row "Duplicate", and a "Next" that advances to the Condenser screen.
- **Compressor Entry screen** (`/audit/:auditId/section/refrigeration/rack/:rackId/compressor/:compressorId`) — model-number lookup with auto-populate, model-not-found amber alert, manual entry, and new-model Admin notification on submit.
- **Rack General re-point** — Story 3.2's `RackGeneralPage` "Next" currently targets a `pipe-headers` stub; this story re-points it to the Compressor List.
- **App.tsx routing** — replaces the `pipe-headers` stub with the two real compressor routes plus a `condenser` stub for Story 3.4.
- **Dev seed** — adds a handful of `compressor_refs` rows so the auto-populate path is exercisable locally.

**Out of scope (deferred — do NOT build):**
- Rack sub-equipment screens **Pipe Headers, Oil Management, Receiver, Defrost Differential Valve, Subcooler, Heat Reclaim** (Epic 3B Features 3B.2–3B.7). These are NOT in `epic-03` Story 3.3's acceptance criteria — they belong to a later refrigeration story. The `pipe-headers` route name from Story 3.2 is retired here.
- **Machine Room Leak Detector** (Epic 3A 3A.3.2.3, screens 2.106–2.107) — deferred.
- **Compressor photo screens** — Epic 4 (photo capture infrastructure not yet built).
- **Real email send** for the `compressor-model-unknown` template — Story 5.5. This story only **enqueues** the stub job (the worker logs it; no Resend call yet — same as the `auditor-welcome` job today).
- **Admin compressor-DB management UI** (add/update/retire models) — Story 6.2.
- **Condenser / Walk-In / Display Case screens** — Story 3.4.
- **Rack-level / section completion tracking** and `current_section_id` updates — Story 3.5 (compressor patch does NOT touch `audit_sections`, same as the rack patch).

## Acceptance Criteria

1. **AC1 — Compressor regression-DB lookup endpoint.** `GET /api/v1/compressors/:model` (any authenticated role):
   - Looks up `compressor_refs` by `model_number`. `compressor_refs` is **GLOBAL reference data** — not tenant-scoped, not RLS-protected — so the query runs on the plain Prisma client, NOT inside `request.withRls(...)`.
   - On match → `200` with `compressorRefSchema`: `{ id, compressorDbVersion, modelNumber, manufacturer, refrigerantType, regressionCoefficients, createdAt }`, where `regressionCoefficients` is the parsed JSON object.
   - On no match → `404` RFC 7807 problem detail (`type: …/compressor-model-not-found`).
   - Accepts an optional `?version=` query param; when present, filters by `compressor_db_version`; when absent, returns the row from the **latest** `compressor_db_version` for that model (the SPA omits it in this story — see Dev Notes "FR10 note").

2. **AC2 — Compressor List screen.** At `/audit/:auditId/section/refrigeration/rack/:rackId/compressors`:
   - Fetches all compressors via `GET …/racks/:rackId/compressors`.
   - Each compressor shows its label (`data.general.modelNumber` if set, else `Compressor {compressorNumber}`) and a completion-status chip: **Not Started** (`data` is `{}`), **In Progress** (some data, no `modelNumber`), **Complete** (`data.general.modelNumber` set).
   - An "**Add Compressor**" button (`data-testid="add-compressor-btn"`) calls `POST …/compressors`, then navigates to the new compressor's Entry screen.
   - A per-row "**Duplicate**" button (`data-testid="duplicate-compressor-{compressorId}"`) calls `POST …/compressors/:compressorId/duplicate`, then navigates to the new compressor's Entry screen.
   - A fixed-bottom "**Next**" button (`data-testid="next-btn"`) navigates to `/audit/:auditId/section/refrigeration/rack/:rackId/condenser` (Story 3.4 stub).
   - Loading skeleton while fetching; `role="alert"` error if the fetch fails.
   - Breadcrumb: "Refrigeration › Rack N › Compressors" — "Refrigeration" → `/audit/:auditId`, "Machine Room" segment NOT shown (rack-level breadcrumb per Story 3.2 AC5 of the epic uses `Rack N`); "Rack N" → `/audit/:auditId/section/refrigeration/rack/:rackId/general`.

3. **AC3 — Compressor Entry: model lookup auto-populate (epic AC1).** At `/audit/:auditId/section/refrigeration/rack/:rackId/compressor/:compressorId`:
   - Fields rendered: **Compressor Model Number\*** (required, free-text), **Make/Manufacturer**, **Serial Number**, **Capacity (BTU/h)**, **EER**, **Refrigerant Type** (dropdown), **Comment**.
   - When the Auditor enters a model number, a debounced (600 ms) lookup calls `GET /api/v1/compressors/:model`.
   - On a **match**, the Make, Refrigerant Type, Capacity, and EER fields auto-populate (Make ← `manufacturer`; Refrigerant Type ← `refrigerantType`; Capacity ← `regressionCoefficients.capacity`; EER ← `regressionCoefficients.eer` — populate Capacity/EER only when those keys exist in `regressionCoefficients`). The matched `CompressorRef.id` is stored as the compressor's `compressorRefId`.
   - **Every** auto-populated value remains editable — the Auditor can override any field.
   - Each field has a `?` `FieldHelpTooltip`. Breadcrumb: "Refrigeration › Rack N › Compressor M" (`M` = `compressorNumber`), truncating with ellipsis beyond `max-w-[60vw]`.

4. **AC4 — Compressor Entry: model-not-found amber alert (epic AC2).** When the lookup returns `404`:
   - An inline **amber** alert appears (`data-testid="model-not-found-alert"`, `role="status"`): "Model not found — enter specs manually. Admin will be notified."
   - All spec fields remain fully editable; `compressorRefId` is cleared to `null`.
   - The alert clears automatically if the Auditor edits the model number to a value that subsequently matches.

5. **AC5 — New-model Admin notification (epic AC3 / FR53).** When the Auditor taps "Next" on a Compressor Entry screen whose model was **not found** (no `compressorRefId`):
   - The SPA calls `POST …/compressors/:compressorId/report-unknown-model` before navigating.
   - The endpoint enqueues a `cems-email-notification-low` job (`templateId: 'compressor-model-unknown'`) for **each ACTIVE Admin in the tenant**, with `variables: { modelNumber, auditId, rackId, compressorId }`. It then sets `data.unknownModelReported = true` on the compressor row so a revisit does NOT re-notify (idempotent — a second call returns `{ reported: false, alreadyReported: true }` and enqueues nothing).
   - Auditor progression is **never blocked**: navigation proceeds even if the notify call fails (fire-and-forget on the SPA; the endpoint itself never throws on "0 admins found" — it logs and returns `{ reported: true, adminsNotified: 0 }`).

6. **AC6 — Compressor Entry validation.** Tapping "Next" with **Compressor Model Number** empty blocks navigation; the field gets `border-danger` + `animate-shake`; the "Next" label shows "N required field(s) remaining". No modal. Attempt-first (`mode: 'onSubmit'`).

7. **AC7 — Compressor auto-save.** Any field change triggers an 800 ms debounced `PATCH …/compressors/:compressorId` with `{ data: { general: <formValues> }, compressorRefId }`. `AutoSaveIndicator` shows ✓ Saved / saving / retrying / error; `OfflineBanner` shows when offline. Mirrors `useAutoSaveRack` exactly, but the PATCH body additionally carries `compressorRefId`.

8. **AC8 — Compressor "Next" navigation.** A valid submit (model number present) flushes auto-save, fires the AC5 notification when applicable, then navigates **back to the Compressor List** (`…/rack/:rackId/compressors`) so the Auditor can add the next compressor or advance to the Condenser.

9. **AC9 — Compressor duplication (epic AC5 / FR7).** `POST …/compressors/:compressorId/duplicate` creates a new compressor copying the source's `data` and `compressorRefId`, **except** `data.general.serialNumber` is cleared (serial number is unique per physical unit; model, refrigerant, EER, capacity are intentionally retained). New `compressorNumber` = next available integer. Responds with the new `Compressor`. AUDITOR only; must own a DRAFT audit.

10. **AC10 — Compressor API: create.** `POST …/racks/:rackId/compressors` (body `{}`), AUDITOR only, audit must be DRAFT and auditor-owned. Returns the created `Compressor` (`200`). `compressorNumber` = count of existing compressors in the rack + 1. There is **no** DB unique constraint on `[rackId, compressorNumber]` (unlike racks) — so no P2002 retry is needed; derive-and-create once.

11. **AC11 — Compressor API: list + get.** `GET …/racks/:rackId/compressors` → `{ compressors: Compressor[] }` (any authenticated role). `GET …/compressors/:compressorId` → `Compressor | 404`. Both verify the compressor's `rackId` matches the path (`404 compressor-not-found` otherwise).

12. **AC12 — Compressor API: patch.** `PATCH …/compressors/:compressorId` with `{ data: Record<string, unknown>, compressorRefId?: string | null }`, AUDITOR only. The repo's WHERE clause folds in `rackId` to block cross-rack writes (`404 compressor-not-found` via Prisma P2025). Returns `{ savedAt, compressorId }`.

13. **AC13 — Touch targets (epic AC4 / NFR-A1).** Every interactive element on the Compressor List and Compressor Entry screens — inputs, dropdowns, buttons, help icons, Duplicate/Add/Next — meets `min-h-[48px]` (and `min-w-[48px]` for icon-only controls) for gloved-hand operation.

14. **AC14 — Redirects on missing machine room.** If the Compressor List or Compressor Entry screen is reached by direct URL and no machine room exists for the audit, `<Navigate>` to `/audit/:auditId/section/refrigeration` (same guard as `RackGeneralPage`). The compressor pages resolve `roomId` indirectly via `useMachineRooms` exactly like `RackGeneralPage`.

15. **AC15 — Rack General re-point + routing.** `RackGeneralPage`'s "Next" navigates to `…/rack/:rackId/compressors` (was the `pipe-headers` stub). `App.tsx` removes the `pipe-headers` stub route and adds: the Compressor List route, the Compressor Entry route, and a `condenser` stub route (`<div data-testid="condenser-stub">`) so the Compressor List "Next" lands somewhere until Story 3.4. Routes are ordered most-specific-first, ahead of the `:sectionId` catch-all.

## Tasks / Subtasks

- [x] **Task 1 — Sprint-status update**
  - [x] Edit `docs/bmad/_bmad-output/implementation-artifacts/sprint-status.yaml`:
    - `3-3-compressor-screens-and-regression-db-lookup: ready-for-dev → in-progress`
    - `last_updated: 2026-05-22`

- [x] **Task 2 — Types: Compressor + CompressorRef schemas (AC1, AC9–AC12)**
  - [x] Edit `packages/types/src/audit.ts` — add after the rack schemas (end of file):
    ```ts
    // ─── Compressor entity (Story 3.3) ───────────────────────────────────────
    export const compressorSchema = z.object({
      id: z.string(),
      tenantId: z.string().optional(),
      rackId: z.string(),
      compressorNumber: z.string(),
      compressorRefId: z.string().nullable(),
      data: z.record(z.unknown()),
      createdAt: z.string(),
      updatedAt: z.string(),
    })
    export type Compressor = z.infer<typeof compressorSchema>

    export const createCompressorResponseSchema = compressorSchema
    export type CreateCompressorResponse = Compressor

    export const listCompressorsResponseSchema = z.object({ compressors: z.array(compressorSchema) })
    export type ListCompressorsResponse = z.infer<typeof listCompressorsResponseSchema>

    export const getCompressorResponseSchema = compressorSchema
    export type GetCompressorResponse = Compressor

    // params for create/list (no compressorId)
    export const compressorListParamsSchema = z.object({
      auditId: z.string().min(1),
      roomId: z.string().min(1),
      rackId: z.string().min(1),
    })
    export type CompressorListParams = z.infer<typeof compressorListParamsSchema>

    // params for get/patch/duplicate/report (with compressorId)
    export const compressorItemParamsSchema = compressorListParamsSchema.extend({
      compressorId: z.string().min(1),
    })
    export type CompressorItemParams = z.infer<typeof compressorItemParamsSchema>

    export const patchCompressorBodySchema = z.object({
      data: z.record(z.unknown()),
      compressorRefId: z.string().nullable().optional(),
    })
    export type PatchCompressorBody = z.infer<typeof patchCompressorBodySchema>

    export const patchCompressorResponseSchema = z.object({
      savedAt: z.string(),
      compressorId: z.string(),
    })
    export type PatchCompressorResponse = z.infer<typeof patchCompressorResponseSchema>

    export const duplicateCompressorResponseSchema = compressorSchema
    export type DuplicateCompressorResponse = Compressor

    export const reportUnknownModelResponseSchema = z.object({
      reported: z.boolean(),
      alreadyReported: z.boolean().optional(),
      adminsNotified: z.number().int().nonnegative().optional(),
    })
    export type ReportUnknownModelResponse = z.infer<typeof reportUnknownModelResponseSchema>

    // ─── Compressor regression-DB lookup (Story 3.3) ──────────────────────────
    export const compressorRefSchema = z.object({
      id: z.string(),
      compressorDbVersion: z.string(),
      modelNumber: z.string(),
      manufacturer: z.string(),
      refrigerantType: z.string(),
      regressionCoefficients: z.record(z.unknown()),
      createdAt: z.string(),
    })
    export type CompressorRef = z.infer<typeof compressorRefSchema>

    export const getCompressorRefResponseSchema = compressorRefSchema
    export type GetCompressorRefResponse = CompressorRef

    export const compressorLookupQuerySchema = z.object({
      version: z.string().optional(),
    })
    export type CompressorLookupQuery = z.infer<typeof compressorLookupQuerySchema>
    ```
  - [x] Edit `packages/types/src/forms/refrigeration.schema.ts` — add the compressor data sub-schema after `rackGeneralDataSchema`:
    ```ts
    // ─── Story 3.3 — Compressor data sub-schema ───────────────────────────────
    export const compressorDataSchema = z.object({
      modelNumber: z.string().min(1),
      make: z.string().optional(),
      serialNumber: z.string().optional(),
      capacity: z.string().optional(),
      eer: z.string().optional(),
      refrigerantType: z.string().optional(),
      comment: z.string().optional(),
    })
    export type CompressorData = z.infer<typeof compressorDataSchema>
    ```
  - [x] **Do NOT add a new refrigerant constant** — the Compressor "Refrigerant Type" dropdown reuses the existing `RACK_REFRIGERANT_OPTIONS`.
  - [x] `packages/types/src/index.ts` already re-exports `audit.ts` and `forms/refrigeration.schema.ts` via `export *` — **no edit needed** (verify the two `export * from` lines exist; Story 3.2 confirmed this).
  - [x] Run `pnpm --filter @cems/types build` — must pass.

- [x] **Task 3 — Errors: Compressor error types (AC1, AC11, AC12)**
  - [x] Edit `apps/api/src/lib/audit-errors.ts` — add (mirror `RackNotFoundError`):
    ```ts
    export class CompressorNotFoundError extends Error {
      readonly statusCode = 404
      constructor(message = 'Compressor not found or not accessible') {
        super(message)
        this.name = 'CompressorNotFoundError'
      }
    }

    export class CompressorModelNotFoundError extends Error {
      readonly statusCode = 404
      constructor(message = 'Compressor model not found in the regression database') {
        super(message)
        this.name = 'CompressorModelNotFoundError'
      }
    }
    ```
  - [x] Edit `apps/api/src/middleware/error-handler.ts` — import both new errors; add two `instanceof` branches after the `RackNotFoundError` branch:
    - `CompressorNotFoundError` → `404`, slug `compressor-not-found`.
    - `CompressorModelNotFoundError` → `404`, slug `compressor-model-not-found`.
    (Copy the exact shape of the existing `RackNotFoundError` branch — `reply.code(404).send(problem(...))`.)

- [x] **Task 4 — Repo: CompressorRef lookup (AC1)**
  - [x] Create `apps/api/src/repositories/compressor-ref.repo.ts`:
    - `findCompressorRefByModel(db, { modelNumber, version? })` → `CompressorRef | null`.
    - `db` is the plain Prisma client (NOT an RLS tx) — `compressor_refs` has no tenant column / no RLS policy.
    - When `version` given: `where: { modelNumber, compressorDbVersion: version }`, `findFirst`.
    - When `version` absent: `where: { modelNumber }`, `orderBy: { compressorDbVersion: 'desc' }` then `findFirst` (returns the latest version's row; string-desc ordering is acceptable for the `'1.0'`-style versions seeded — note in code).
    - `parseCoefficients(raw: string): Record<string, unknown>` helper (same defensive `JSON.parse` + object guard as `parseData` in `rack.repo.ts`).
    - `mapRow` → `CompressorRef` (ISO-string `createdAt`, parsed `regressionCoefficients`).
  - [x] Create `apps/api/src/repositories/compressor-ref.repo.test.ts` — mock the Prisma client object; cover: found-with-version, found-latest-without-version, not-found (`null`), malformed `regression_coefficients` JSON → `{}`.

- [x] **Task 5 — Repo: Compressor CRUD (AC9–AC12)**
  - [x] Create `apps/api/src/repositories/compressor.repo.ts` — copy the structure of `rack.repo.ts` exactly:
    - `PrismaLike = any` (eslint-disabled), `parseData`, `mapRow` (maps `compressorRefId` straight through — it is `string | null`).
    - `createCompressor(tx, { tenantId, rackId, compressorNumber, compressorRefId?, data? })` → `Compressor`.
    - `getCompressorsByRackId(tx, { rackId })` → `Compressor[]` ordered by `createdAt asc`.
    - `getCompressorById(tx, { id })` → `Compressor | null`.
    - `upsertCompressorData(tx, { id, rackId, tenantId, data, compressorRefId? })` → `{ savedAt, compressorId }`. WHERE folds in `rackId` (cross-rack guard); P2025 → `CompressorNotFoundError`. **When `compressorRefId` key is present in the input** (including `null`), include it in the `data:` update payload; when the key is absent, do NOT touch the column. (Use `'compressorRefId' in input` to decide.)
    - `duplicateCompressor(tx, { sourceId, rackId, tenantId, compressorNumber })` → `Compressor`: read source, guard `source.rackId === rackId` else `CompressorNotFoundError`; build `newData` = parsed source data with `general.serialNumber` deleted; create with `compressorRefId: source.compressorRefId`.
  - [x] Create `apps/api/src/repositories/compressor.repo.test.ts` — 5 describe blocks, mirroring `rack.repo.test.ts`: create, list, getById, upsert (happy + P2025 + cross-rack + compressorRefId-set vs absent), duplicate (clears `serialNumber`, retains `compressorRefId`).

- [x] **Task 6 — Service: Compressor operations + lookup + notify (AC1, AC5, AC9–AC12)**
  - [x] Create `apps/api/src/services/compressor.service.ts` — follow `rack.service.ts` patterns (`ServiceContext`, RLS check, `getAuditOwnership` ownership+DRAFT guard, `RoleNotPermittedError` for non-AUDITOR writes):
    - `createCompressor({ rackId, machineRoomId, auditId }, ctx)` — AUDITOR only; ownership check; `compressorNumber = String(getCompressorsByRackId(...).length + 1)`; create. **No P2002 retry** — there is no `[rackId, compressorNumber]` unique constraint.
    - `getCompressors({ rackId, … }, ctx)` — any role.
    - `getCompressorById({ compressorId, rackId, … }, ctx)` — any role; throws `CompressorNotFoundError` if missing or `rackId` mismatch.
    - `patchCompressor({ compressorId, rackId, auditId, data, compressorRefId? }, ctx)` — AUDITOR only; ownership check; `upsertCompressorData`. Forward `compressorRefId` only when the key was present in the request body (preserve the `'compressorRefId' in body` distinction end-to-end).
    - `duplicateCompressor({ compressorId, rackId, machineRoomId, auditId }, ctx)` — AUDITOR only; ownership check; derive next `compressorNumber`; `duplicateCompressor` repo.
    - `lookupCompressorRef({ model, version? })` — **no `ctx`/RLS needed**; import `{ prisma }` from `@cems/db` and call `findCompressorRefByModel(prisma, { modelNumber: model, version })`; throw `CompressorModelNotFoundError` when `null`. (Role-gating happens at the route layer.)
    - `reportUnknownModel({ compressorId, rackId, auditId }, ctx)` — AUDITOR only; ownership check; inside `withRls`:
      1. `getCompressorById` → guard rackId; if missing → `CompressorNotFoundError`.
      2. If `compressor.data.unknownModelReported === true` → return `{ reported: false, alreadyReported: true }` (no enqueue, no write).
      3. Else: `listUsersByRole(tx, { role: UserRole.ADMIN, status: UserStatus.ACTIVE })`; for each admin, `getEmailNotificationQueue().add('compressor-model-unknown', { to: admin.email, templateId: 'compressor-model-unknown', variables: { modelNumber, auditId, rackId, compressorId }, tenantId: rls.tenantId, auditId })`.
      4. `upsertCompressorData` with `data` = existing data + `{ unknownModelReported: true, unknownModelReportedAt: <ISO now> }` (merge — do NOT drop `general`).
      5. Return `{ reported: true, adminsNotified: admins.length }`.
      - `modelNumber` for `variables` comes from `compressor.data.general?.modelNumber` (string, fall back to `''`).
      - Enqueue is best-effort: wrap the `queue.add` loop so a Redis failure is logged via `request.log`/`logger` and does NOT throw (Auditor must not be blocked — AC5). Still set the `unknownModelReported` flag.
  - [x] Create `apps/api/src/services/compressor.service.test.ts` — mirror `rack.service.test.ts`: happy paths; ADMIN→`RoleNotPermittedError` on writes; `AuditNotEditableError`; `CompressorNotFoundError`; `CompressorModelNotFoundError` from lookup; `reportUnknownModel` enqueues once and is idempotent on second call; `reportUnknownModel` with 0 admins returns `adminsNotified: 0` and still sets the flag. Mock `compressor.repo.js`, `compressor-ref.repo.js`, `audit.repo.js`, `user.repo.js`, and the queue (`vi.mock('../jobs/queue.js', …)`).

- [x] **Task 7 — Routes: Compressor endpoints + lookup + registration (AC1, AC2, AC5, AC9–AC13)**
  - [x] Create `apps/api/src/routes/compressors.routes.ts` — `registerCompressorsRoutes(app)`; follow `racks.routes.ts` patterns (`fastifySchemaFromZod`, `requireRole`, problem-detail responses):
    - `POST /api/v1/audits/:auditId/machine-rooms/:roomId/racks/:rackId/compressors` — AUDITOR, body `{}` (`emptyBodySchema` passthrough), response `createCompressorResponseSchema`.
    - `GET …/racks/:rackId/compressors` — any role, response `listCompressorsResponseSchema`.
    - `GET …/racks/:rackId/compressors/:compressorId` — any role, response `getCompressorResponseSchema`.
    - `PATCH …/racks/:rackId/compressors/:compressorId` — AUDITOR, body `patchCompressorBodySchema`, response `patchCompressorResponseSchema`.
    - `POST …/racks/:rackId/compressors/:compressorId/duplicate` — AUDITOR, body `{}`, response `duplicateCompressorResponseSchema`.
    - `POST …/racks/:rackId/compressors/:compressorId/report-unknown-model` — AUDITOR, body `{}`, response `reportUnknownModelResponseSchema`.
    - `GET /api/v1/compressors/:model` — `requireRole([AUDITOR, ADMIN, CLIENT])`, params `{ model: z.string().min(1) }`, querystring `compressorLookupQuerySchema`, response `{ 200: getCompressorRefResponseSchema, 401, 404 }`. Handler calls `compressorService.lookupCompressorRef({ model, version })`.
    - All audit-scoped routes include `401/403/404` (+ `422` on the body-carrying ones) problem-detail response schemas.
  - [x] Edit `apps/api/src/app.ts` — import + call `registerCompressorsRoutes(app)` after `registerRacksRoutes(app)`.
  - [x] Create `apps/api/src/routes/compressors.routes.test.ts` — `vi.hoisted` + `vi.mock('../services/compressor.service.js', …)`; cover: 401 (no token); 403 (ADMIN on POST/PATCH/duplicate/report); 200 happy paths for all 7 endpoints; 404 (compressor-not-found, compressor-model-not-found); 422 (PATCH missing `data`). Use the mock pattern from `racks.routes.test.ts`.

- [x] **Task 8 — SPA: compressor-api.ts hooks (AC2, AC3, AC5, AC7, AC9)**
  - [x] Create `apps/audit-app/src/features/audit/compressor-api.ts`:
    - URL helper: `compressorsUrl(auditId, roomId, rackId)` → `…/racks/{rackId}/compressors` (encode every segment).
    - `useCompressors(auditId, roomId, rackId)` — `useQuery<ListCompressorsResponse>`, key `['audits', auditId, 'machine-rooms', roomId, 'racks', rackId, 'compressors']`, `enabled` on all three ids, `staleTime: 30_000`.
    - `useCompressor(auditId, roomId, rackId, compressorId)` — single-compressor `useQuery<GetCompressorResponse>` for hydration, `staleTime: 30_000`.
    - `useCreateCompressor()` — `useMutation` `POST …/compressors`.
    - `useDuplicateCompressor()` — `useMutation` `POST …/compressors/:compressorId/duplicate`.
    - `useReportUnknownModel()` — `useMutation` `POST …/compressors/:compressorId/report-unknown-model`.
    - `useCompressorRefLookup(model)` — `useQuery<GetCompressorRefResponse>` keyed `['compressor-ref', model]`, `queryFn` → `apiFetch('/api/v1/compressors/' + encodeURIComponent(model))`, `enabled: !!model && model.trim().length > 0`, `retry: false` (never retry — a 404 is an expected branch), `staleTime: 5 * 60_000`. The 404 surfaces as `query.error instanceof ApiError && query.error.status === 404`.
    - `useAutoSaveCompressor(auditId, roomId, rackId, compressorId)` — copy `useAutoSaveRack` verbatim, but: (a) the PATCH URL is `…/compressors/{compressorId}`; (b) `save` accepts `(payload: { data: Record<string, unknown>; compressorRefId?: string | null })` and the PATCH body is `JSON.stringify(payload)`; (c) re-export `type CompressorAutoSaveState = AutoSaveState`.

- [x] **Task 9 — SPA: Compressor List screen (AC2, AC13, AC14)**
  - [x] Create `apps/audit-app/src/features/audit/CompressorListPage.tsx` — model on `RackListPage.tsx`:
    - `useParams` → `auditId`, `rackId`. `useMachineRooms(auditId)` → `roomId`. `useRack(auditId, roomId, rackId)` → `rackNumber` for the breadcrumb. `useCompressors(auditId, roomId, rackId)`.
    - Redirect `<Navigate to={`/audit/${auditId}/section/refrigeration`} replace />` when `machineRooms.length === 0`.
    - Status chip via `getCompressorStatus(compressor)`: `Complete` if `data.general?.modelNumber`; `In Progress` if `Object.keys(data).length > 0`; else `Not Started` (reuse the `STATUS_VARIANT` Badge mapping from `RackListPage`).
    - Row label: `data.general?.modelNumber` ?? `Compressor {compressorNumber}`.
    - "Add Compressor" (`data-testid="add-compressor-btn"`) → `useCreateCompressor().mutate(…, { onSuccess: (c) => navigate(entryUrl(c.id)) })`.
    - Per-row "Duplicate" (`data-testid="duplicate-compressor-{id}"`) → `useDuplicateCompressor().mutate(…, { onSuccess })`.
    - Fixed-bottom "Next" (`data-testid="next-btn"`) → `navigate(`/audit/${auditId}/section/refrigeration/rack/${rackId}/condenser`)`.
    - Loading skeleton (`aria-busy`); `role="alert"` error.
    - Breadcrumb: `[{ label: 'Refrigeration', to: `/audit/${auditId}` }, { label: rackNumber ? `Rack ${rackNumber}` : 'Rack …', to: `/audit/${auditId}/section/refrigeration/rack/${rackId}/general` }, { label: 'Compressors' }]`.
    - data-testids: `compressor-list`, `compressor-card-{id}`, `compressor-status-{id}`, `add-compressor-btn`, `duplicate-compressor-{id}`, `next-btn`. Touch targets `min-h-[48px]` (icon-only also `min-w-[48px]`).
  - [x] Create `apps/audit-app/src/features/audit/CompressorListPage.test.tsx` — 8 tests: skeleton while loading; error alert on fetch fail; renders list + status chips; Not Started chip; Complete chip; Add triggers mutation + nav; Duplicate triggers mutation + nav; "Next" navigates to the `condenser` route. Mock `machine-room-api`, `rack-api`, `compressor-api`.

- [x] **Task 10 — SPA: Compressor Entry screen (AC3, AC4, AC6, AC7, AC8, AC13, AC14)**
  - [x] Create `apps/audit-app/src/features/audit/CompressorEntryPage.tsx` — model on `RackGeneralPage.tsx`:
    - `useParams` → `auditId`, `rackId`, `compressorId`. `useMachineRooms` → `roomId`; redirect if no machine room. `useRack` → `rackNumber` (breadcrumb). `useCompressor(auditId, roomId, rackId, compressorId)` for hydration. `useAutoSaveCompressor(...)`.
    - `react-hook-form`, `mode: 'onSubmit'`, fields: `modelNumber`, `make`, `serialNumber`, `capacity`, `eer`, `refrigerantType`, `comment`. Hydrate from `compressor.data.general` in a `useEffect`.
    - Hold `compressorRefId` in React state, seeded from `compressor.data` query (`compressor.compressorRefId`).
    - **Model lookup:** `watch('modelNumber')` → debounce 600 ms into a `debouncedModel` state → `useCompressorRefLookup(debouncedModel)`.
      - On `lookupQ.data` (match) `useEffect`: `setValue` Make/RefrigerantType/Capacity/EER from the ref (Capacity/EER only if present in `regressionCoefficients`); `setCompressorRefId(ref.id)`; clear the not-found flag. Do NOT clobber a field the Auditor has manually edited after the lookup — simplest acceptable approach: auto-fill on every fresh match (the Auditor re-edits if needed); document this choice.
      - On `lookupQ.error` with `status === 404`: set `modelNotFound = true`; `setCompressorRefId(null)`.
      - Clear `modelNotFound` whenever a new lookup starts/succeeds.
    - **Amber alert (AC4):** when `modelNotFound`, render `<p role="status" data-testid="model-not-found-alert" className="… bg-amber-50 text-amber-800 border border-amber-300 …">Model not found — enter specs manually. Admin will be notified.</p>` (use the project's amber/warning Tailwind tokens — check `packages/config/tailwind/preset.ts`; if no `amber` token, use `warning`-based classes consistent with the `Badge` `warning` variant).
    - **Auto-save (AC7):** `watch()` subscription → `autoSave.save({ data: { general: getValues() }, compressorRefId })`. Because `compressorRefId` also changes outside the form, add a second `useEffect` that calls `autoSave.save(...)` when `compressorRefId` changes (so the link/unlink persists).
    - **Validation (AC6):** `onInvalid` → `setAttempted(true)`; `errorCount = modelNumberError ? 1 : 0`; "Next" label shows the count.
    - **onValid (AC8):** `autoSave.flush()`; if `compressorRefId == null` AND `modelNumber` non-empty → `await reportUnknownModel.mutateAsync({ auditId, roomId, rackId, compressorId })` inside a `try/catch` that swallows errors (never block navigation); then `navigate(`/audit/${auditId}/section/refrigeration/rack/${rackId}/compressors`)`.
    - Breadcrumb: `[{ 'Refrigeration', to:`/audit/${auditId}` }, { `Rack ${rackNumber}` or `Rack …`, to: rack general }, { `Compressor ${compressorNumber}` or `Compressor …` }]`. The final `AuditBreadcrumb` segment already truncates per the component (verify it applies `max-w-[60vw]` + ellipsis — Story 3.1 built this).
    - Loading skeleton + `role="alert"` error, same as `RackGeneralPage`.
    - data-testids: `compressor-model`, `compressor-make`, `compressor-serial`, `compressor-capacity`, `compressor-eer`, `compressor-refrigerant`, `comment-field`, `model-not-found-alert`, `next-btn`. Touch targets `min-h-[48px]`.
  - [x] Create `apps/audit-app/src/features/audit/CompressorEntryPage.test.tsx` — 10 tests: skeleton while loading; error alert on fetch fail; renders all fields; empty model blocks "Next" (count label); model lookup match auto-populates Make/Refrigerant/Capacity/EER (fake timers for the 600 ms debounce; mock `useCompressorRefLookup`); 404 lookup shows the amber alert; auto-populated field is editable (override persists); valid submit with a found model navigates to the compressor list WITHOUT calling report-unknown-model; valid submit with an unknown model calls `reportUnknownModel` then navigates; passes axe scan. Mock `machine-room-api`, `rack-api`, `compressor-api`.

- [x] **Task 11 — SPA: Rack General re-point + App.tsx routing (AC15)**
  - [x] Edit `apps/audit-app/src/features/audit/RackGeneralPage.tsx` — change `onValid` navigation target from `…/rack/${rackId}/pipe-headers` to `…/rack/${rackId}/compressors`.
  - [x] Edit `apps/audit-app/src/features/audit/RackGeneralPage.test.tsx` — the in-test `MemoryRouter` route that currently stubs `pipe-headers` must now stub `…/rack/:rackId/compressors` (e.g. `<Route path="…/compressors" element={<div data-testid="compressors-stub" />} />`); update the "valid form navigates" assertion to expect `compressors-stub`.
  - [x] Edit `apps/audit-app/src/App.tsx`:
    - Import `CompressorListPage` and `CompressorEntryPage`.
    - **Remove** the `pipe-headers` stub `<Route>`.
    - Add (most-specific-first, before the `/audit/:auditId/section/refrigeration` and `:sectionId` routes):
      ```tsx
      <Route path="/audit/:auditId/section/refrigeration/rack/:rackId/compressors"
        element={<RequireAuth surface={SURFACE}><CompressorListPage /></RequireAuth>} />
      <Route path="/audit/:auditId/section/refrigeration/rack/:rackId/compressor/:compressorId"
        element={<RequireAuth surface={SURFACE}><CompressorEntryPage /></RequireAuth>} />
      {/* Stub for Story 3.4 condenser route (so the Compressor List "Next" lands somewhere). */}
      <Route path="/audit/:auditId/section/refrigeration/rack/:rackId/condenser"
        element={<RequireAuth surface={SURFACE}><div data-testid="condenser-stub">Condenser — Story 3.4</div></RequireAuth>} />
      ```
    - Keep the existing `…/rack/:rackId/general` route. Order among the `…/rack/:rackId/*` routes does not matter (distinct static suffixes), but all must precede `/audit/:auditId/section/:sectionId`.

- [x] **Task 12 — Dev seed: compressor_refs sample rows**
  - [x] Edit `packages/db/scripts/seed-test-users.ts` — add a `SEED_COMPRESSOR_REFS` array (4 rows, `compressorDbVersion: '1.0'`) and an idempotent upsert loop using the compound unique:
    ```ts
    const SEED_COMPRESSOR_REFS = [
      { modelNumber: 'ZB45KCE-TFD', manufacturer: 'Copeland', refrigerantType: 'R-404A',
        regressionCoefficients: { capacity: '45000', eer: '11.2', coefficients: [0.92, -0.013, 0.0007] } },
      { modelNumber: 'ZF18K4E-TFD', manufacturer: 'Copeland', refrigerantType: 'R-448A',
        regressionCoefficients: { capacity: '18000', eer: '9.8', coefficients: [0.88, -0.011, 0.0006] } },
      { modelNumber: '4DES-7Y',     manufacturer: 'Bitzer',   refrigerantType: 'R-448A',
        regressionCoefficients: { capacity: '62000', eer: '12.1', coefficients: [0.95, -0.014, 0.0008] } },
      { modelNumber: 'D4DA3-1000',  manufacturer: 'Carlyle',  refrigerantType: 'R-22',
        regressionCoefficients: { capacity: '100000', eer: '10.4', coefficients: [0.90, -0.012, 0.0007] } },
    ]
    // in main():
    for (const ref of SEED_COMPRESSOR_REFS) {
      await prisma.compressorRef.upsert({
        where: { compressorDbVersion_modelNumber: { compressorDbVersion: '1.0', modelNumber: ref.modelNumber } },
        update: { manufacturer: ref.manufacturer, refrigerantType: ref.refrigerantType,
          regressionCoefficients: JSON.stringify(ref.regressionCoefficients) },
        create: { compressorDbVersion: '1.0', modelNumber: ref.modelNumber, manufacturer: ref.manufacturer,
          refrigerantType: ref.refrigerantType, regressionCoefficients: JSON.stringify(ref.regressionCoefficients) },
      })
    }
    ```
    - `compressor_refs` is global (no `tenantId`) — the upsert needs no RLS context. Verify the generated compound-unique input name is `compressorDbVersion_modelNumber` (Prisma derives it from the `@@unique([compressorDbVersion, modelNumber])`); adjust if `pnpm --filter @cems/db db:generate` output differs.
    - Add a `console.log` line for the seeded compressor count, matching the script's existing logging style. Update the script's header comment to mention the compressor_refs seeding.

- [x] **Task 13 — Validations: lint + type-check + tests (DoD)**
  - [x] `pnpm --filter @cems/types build` then `pnpm turbo run lint type-check test` — all packages pass; SPAs at 0 warnings (`--max-warnings=0`).
  - [x] Verify the axe test passes for `CompressorEntryPage` (and `CompressorListPage` if an axe assertion is added).
  - [x] Verify Story 3.2's `RackGeneralPage.test.tsx` passes with the re-pointed navigation.
  - [x] Confirm no API regressions: `pnpm --filter @cems/api exec vitest run`.

## Dev Notes

### Critical Architecture Context

**`Compressor` and `CompressorRef` DB models ALREADY EXIST — no migration needed.** Verify:
```bash
grep -A 16 "model Compressor " packages/db/prisma/schema.prisma
grep -A 14 "model CompressorRef" packages/db/prisma/schema.prisma
```
- `Compressor`: `id, tenantId, rackId, compressorNumber, compressorRefId (String?), data (default "{}"), createdAt, updatedAt`. **No `@@unique` on `[rackId, compressorNumber]`** — so, unlike racks, there is NO P2002 concurrency retry for `createCompressor`.
- `CompressorRef`: `id, compressorDbVersion, modelNumber, manufacturer, refrigerantType, regressionCoefficients (NVarChar Max — JSON string), createdAt`. `@@unique([compressorDbVersion, modelNumber])`. **GLOBAL reference data — NOT tenant-scoped, NOT RLS-protected** (see the schema comment above the model).

**`compressor_refs` is queried WITHOUT RLS.** Every other repo here takes an RLS `tx` from `request.withRls(...)`. The compressor lookup is the exception: `compressor_refs` has no `tenant_id` and no RLS policy. `compressor-ref.repo.ts` accepts the **plain Prisma client**, and `compressor.service.ts#lookupCompressorRef` imports it directly:
```ts
import { prisma } from '@cems/db'
// ...
const ref = await findCompressorRefByModel(prisma, { modelNumber: model, version })
if (!ref) throw new CompressorModelNotFoundError()
```
Do NOT wrap the lookup in `request.withRls(...)`.

**Repo / service / route layering — copy the rack trio exactly.** `compressor.repo.ts` ⇄ `rack.repo.ts`, `compressor.service.ts` ⇄ `rack.service.ts`, `compressors.routes.ts` ⇄ `racks.routes.ts`. The only structural deltas:
- No P2002 retry in `createCompressor` (no unique constraint).
- `PATCH` body carries an optional `compressorRefId` (use `'compressorRefId' in body` to distinguish "set to null" from "not provided").
- Two extra endpoints: the global `GET /api/v1/compressors/:model` lookup, and `POST …/compressors/:compressorId/report-unknown-model`.

**Ownership / role guard pattern (from `rack.service.ts`):**
```ts
const rls = ctx.request.rlsContext
if (!rls) throw new Error('… requires an authenticated request')
if (rls.role !== UserRole.AUDITOR) throw new RoleNotPermittedError()   // writes only
return ctx.request.withRls(async (tx) => {
  const ownership = await getAuditOwnership(tx, auditId)
  if (!ownership || ownership.auditorUserId !== rls.userId || ownership.status !== AuditStatus.DRAFT) {
    throw new AuditNotEditableError()
  }
  // …
})
```

**`report-unknown-model` — Admin lookup + email enqueue.** Reuse the existing primitives — do NOT invent new ones:
- `listUsersByRole(tx, input)` in `apps/api/src/repositories/user.repo.ts` — signature: `(tx, { role: UserRole; status?: UserStatus; limit? }) => Promise<{ users: AdminUser[]; total }>`. Call with `{ role: UserRole.ADMIN, status: UserStatus.ACTIVE }`. `AdminUser` has `.email` and `.name`.
- `getEmailNotificationQueue()` in `apps/api/src/jobs/queue.ts` → BullMQ `Queue`; `queue.add(templateId, payload)`. The payload must satisfy `emailNotificationPayloadSchema` (`apps/api/src/jobs/email-notification.job.ts`): `{ to: <email>, templateId, variables, tenantId, auditId? }`.
- The email-notification worker is **stub-only** until Story 5.5 — it logs and returns `{ delivered: true }`. No Resend call happens. This story enqueues the job exactly the way `user.service.createUser` enqueues `auditor-welcome`; that is the whole of FR53's MVP surface.
- **Idempotency:** the `data.unknownModelReported` flag prevents duplicate Admin emails when the Auditor revisits the screen. A second `report-unknown-model` call short-circuits before any enqueue.
- **Never block the Auditor:** wrap the enqueue loop so a Redis/queue error is logged (`ctx.request.log.error(...)`) and swallowed. Still write the `unknownModelReported` flag. The route returns `200` regardless.

**Compressor `data` shape (JSON blob, mirrors the rack convention):**
```ts
compressor.data = {
  general?: { modelNumber, make?, serialNumber?, capacity?, eer?, refrigerantType?, comment? },
  unknownModelReported?: boolean,
  unknownModelReportedAt?: string,   // ISO
}
```
The form values map 1:1 to `data.general`. `unknownModelReported*` are written only by `reportUnknownModel` — when it merges, spread the existing `data` first so `general` is preserved (same merge discipline as the Story 3.2 Exhaust page).

**FR10 note — `compressor_db_version`.** The audit row is stamped with `compressor_db_version` at creation (`audit.service.ts` → `getLatestCompressorDbVersion`). For full FR10 reproducibility the lookup should eventually be pinned to the audit's stamped version. This story keeps the SPA calling the bare `GET /api/v1/compressors/:model` (latest version); the endpoint already accepts an optional `?version=` param so a future calc/version-pinning story is forward-compatible. Do NOT build version-pinning UI now.

**Model-number path param.** `GET /api/v1/compressors/:model` takes the model as a path segment; the SPA MUST `encodeURIComponent(model)`. Most compressor model numbers are alphanumeric + dashes; a model containing a literal `/` is an unsupported edge case for the path-param form (acceptable for MVP — note only). Do not switch to a query param: the epic AC fixes the `:model` path shape.

**Lookup query in React Query.** `apiFetch` throws `ApiError` on non-2xx. The lookup `useQuery` must set `retry: false` so a `404` does not retry; the 404 branch is detected via `query.error instanceof ApiError && query.error.status === 404`. `ApiError` and `apiFetch` are exported from `apps/audit-app/src/lib/api-client`.

**Auto-save hook.** Copy `useAutoSaveRack` from `rack-api.ts` verbatim into `useAutoSaveCompressor`; the ONLY changes are the PATCH URL and that `save()` takes `{ data, compressorRefId? }` and sends it as the whole JSON body (the rack version sends `{ data }`). Keep the debounce (800 ms), retry ladder (`[2000, 5000, 15000]`), `online` re-fire, and unmount cleanup identical.

**`compressorRefId` persistence.** It changes outside the RHF form (on lookup success/404). Add a dedicated `useEffect([compressorRefId])` that calls `autoSave.save({ data: { general: getValues() }, compressorRefId })` so link/unlink is persisted even when no form field changed. The `watch()` subscription handles the field-change path.

**Page templates to copy:**
- `CompressorListPage.tsx` ← `RackListPage.tsx` (status chips, `STATUS_VARIANT`, Add/Duplicate mutations, fixed-bottom button, redirect guard). Add a "Next" fixed-bottom button; keep "Add Compressor" as an inline full-width button above it (two stacked actions).
- `CompressorEntryPage.tsx` ← `RackGeneralPage.tsx` (RHF `mode: 'onSubmit'`, hydrate-from-data `useEffect`, `watch()` auto-save, attempt-first validation, fixed-bottom "Next", `FieldHelpTooltip` per field, `AutoSaveIndicator` + `OfflineBanner`).

**Breadcrumb component.** `AuditBreadcrumb` (Story 3.1) renders `<nav aria-label="Audit navigation"><ol>`; the last segment truncates (`max-w-[60vw]` + ellipsis). Pass `{ label, to? }` segments; omit `to` on the current (last) segment.

**`audit_sections` / `current_section_id`.** Like `upsertRackData`, `upsertCompressorData` does NOT touch `audit_sections` or `audits.current_section_id`. Refrigeration section completion is Story 3.5. Do not add section-tracking side-effects.

**Routing order in `App.tsx`.** All `…/rack/:rackId/*` routes (general, compressors, compressor/:compressorId, condenser) have distinct static suffixes, so their relative order is irrelevant — but every one of them MUST appear before `/audit/:auditId/section/refrigeration` (which is itself before the `/audit/:auditId/section/:sectionId` catch-all). The Story 3.2 file already orders things correctly; just slot the new routes into the existing refrigeration block and delete the `pipe-headers` stub.

### API path structure
```
GET    /api/v1/compressors/:model                                                  (global lookup, any role)
POST   /api/v1/audits/:auditId/machine-rooms/:roomId/racks/:rackId/compressors
GET    /api/v1/audits/:auditId/machine-rooms/:roomId/racks/:rackId/compressors
GET    /api/v1/audits/:auditId/machine-rooms/:roomId/racks/:rackId/compressors/:compressorId
PATCH  /api/v1/audits/:auditId/machine-rooms/:roomId/racks/:rackId/compressors/:compressorId
POST   /api/v1/audits/:auditId/machine-rooms/:roomId/racks/:rackId/compressors/:compressorId/duplicate
POST   /api/v1/audits/:auditId/machine-rooms/:roomId/racks/:rackId/compressors/:compressorId/report-unknown-model
```

### Test mock pattern (routes test)
```ts
const { compressorServiceMock } = vi.hoisted(() => ({
  compressorServiceMock: {
    createCompressor: vi.fn(),
    getCompressors: vi.fn(),
    getCompressorById: vi.fn(),
    patchCompressor: vi.fn(),
    duplicateCompressor: vi.fn(),
    reportUnknownModel: vi.fn(),
    lookupCompressorRef: vi.fn(),
  },
}))
vi.mock('../services/compressor.service.js', () => compressorServiceMock)
```
For the service test, mock `../jobs/queue.js` so `getEmailNotificationQueue().add` is a `vi.fn()` you can assert on; mock `../repositories/user.repo.js` so `listUsersByRole` returns a controllable admin list. Untyped `vi.fn` mocks gave `.mock.calls` a zero-length tuple type in Story 3.2 — give repo/queue mocks explicit `vi.fn<(…)=>…>()` signatures (see `rack.repo.test.ts`).

### API Testing Layer (three-layer pattern — CLAUDE.md § API Testing Pattern)
1. **Route tests** (`.routes.test.ts`) — mock the service; verify HTTP codes, role guards, 401/403/404/422, query-param coercion.
2. **Service tests** (`.service.test.ts`) — mock the repos + queue + user.repo; verify role guard, ownership/DRAFT check, `reportUnknownModel` idempotency + 0-admins path, `lookupCompressorRef` → `CompressorModelNotFoundError`.
3. **Repo tests** (`.repo.test.ts`) — mock the Prisma `tx` (or plain client for the ref repo); verify WHERE clauses, the cross-rack guard, P2025 mapping, JSON parse fallbacks, `serialNumber` clearing on duplicate.

### Previous Story Intelligence (Story 3.2 — Rack Entry)

- The **Rack trio** (`rack.repo.ts` / `rack.service.ts` / `racks.routes.ts`) is the precise template for the compressor trio. Mirror it; do not improvise new patterns.
- Story 3.2 left a `pipe-headers` stub route in `App.tsx` and a `pipe-headers` navigation target in `RackGeneralPage.tsx` **explicitly for this story to replace** — see Story 3.2 Dev Notes "SectionEditPage stub for `pipe-headers`". Retiring it is part of AC15.
- `packages/types/src/index.ts` re-exports `audit.ts` and `forms/refrigeration.schema.ts` via `export *` — Task 2 needs no `index.ts` edit (Story 3.2 confirmed this).
- The `upsertRackData` cross-room WHERE guard (folding `machineRoomId` into the `update` WHERE so a P2025 surfaces a not-found) is the exact pattern for `upsertCompressorData` folding in `rackId`.
- Story 3.2's `MachineRoomVentilationPage`/`MachineRoomExhaustPage` established the merge-don't-replace discipline for nested JSON `data` — `reportUnknownModel` must spread existing `data` before adding `unknownModelReported`.
- **Pre-existing working-tree failures (NOT caused by this story):** Story 3.2's Debug Log noted `AutoSaveIndicator.test.tsx` (1) and `useAutoSaveSection.test.ts` (2) fail on uncommitted WIP modifications present before Story 3.2. These four files (`AutoSaveIndicator.{tsx,test.tsx}`, `useAutoSaveSection.{ts,test.ts}`) still carry that WIP. Story 3.3 touches none of them — if those 3 tests fail, they are the same pre-existing WIP, not a regression. Do NOT "fix" them as part of this story; note them in the Debug Log and move on.

### Git Intelligence

Recent commits: `feat(epic-3): refrigeration machine room + rack data collection (Stories 3.1–3.2)` (32556dd) is the immediate predecessor — the rack/machine-room code landed there. The three preceding commits are CI fixes (pnpm deploy, prisma client copy, workspace compile) — infrastructure only, no bearing on this story's code.

### Dropdown / Field Rationale

- **Refrigerant Type** reuses `RACK_REFRIGERANT_OPTIONS` (`R-22 | R-404A | R-407A | R-407C | R-410A | R-448A | R-449A | R-452A | R-454C | R-717 (Ammonia) | Other`). A compressor's refrigerant is the same physical set as the rack's; a separate constant would drift.
- **Capacity / EER are free-text numeric inputs**, not dropdowns — they are continuous values, and when auto-populated from `regressionCoefficients` they may be arbitrary numbers. Stored as strings in `data.general` (consistent with how `rackGeneralDataSchema` keeps numeric-ish fields as `z.string().optional()`).
- **Only Model Number is required** — capacity/EER/refrigerant are auto-filled when the model is known, and must stay optional so an unknown-model compressor can still be saved (the manual-entry path is itself the FR45 fallback).
- **Seed models** are real-world commercial compressors: Copeland `ZB`/`ZF` scroll, Bitzer `4DES` semi-hermetic reciprocating, Carlyle `D4DA3`. `regressionCoefficients` carries nominal `capacity`/`eer` plus a placeholder `coefficients` array — the real regression math is Epic 8; the shape just needs to exercise the auto-populate path.

### References

- [Source: docs/bmad/_bmad-output/planning-artifacts/star-energy-review/epic-03-refrigeration-data-collection-core-audit-engine.md#Story 3.3] — the 5 authoritative ACs (model lookup, 404 amber alert, FR53 notification, touch targets, duplication).
- [Source: docs/bmad/_bmad-output/implementation-artifacts/3-2-rack-entry-navigation-and-equipment-duplication.md] — rack trio patterns; `pipe-headers` stub left for this story.
- [Source: packages/db/prisma/schema.prisma#model Compressor / model CompressorRef] — entity columns; `compressor_refs` global / no-RLS comment.
- [Source: apps/api/src/services/rack.service.ts] — ownership/role-guard + `withRls` template.
- [Source: apps/api/src/repositories/rack.repo.ts] — `parseData`/`mapRow`, cross-scope WHERE guard, P2025 mapping.
- [Source: apps/api/src/routes/racks.routes.ts] — `fastifySchemaFromZod` + `requireRole` route shape.
- [Source: apps/api/src/services/user.service.ts#L105-L116] — `getEmailNotificationQueue().add(templateId, payload)` enqueue pattern.
- [Source: apps/api/src/jobs/email-notification.job.ts] — `emailNotificationPayloadSchema`; worker is stub-only until Story 5.5.
- [Source: apps/api/src/repositories/user.repo.ts#listUsersByRole] — tenant Admin lookup for FR53.
- [Source: apps/audit-app/src/features/audit/rack-api.ts] — `useAutoSaveRack` to clone; `ApiError`/`apiFetch` usage.
- [Source: apps/audit-app/src/features/audit/RackGeneralPage.tsx / RackListPage.tsx] — SPA page templates.
- [Source: docs/bmad/_bmad-output/planning-artifacts/architecture.md#L275] — canonical compressor URL: `/audit/:auditId/section/refrigeration/rack/:rackId/compressor/:compressorId`.
- [Source: docs/bmad/_bmad-output/planning-artifacts/prd.md#FR45,FR53] — model-not-found admin alert + on-site new-compressor entry.

### Project Structure Notes

- New SPA files live in `apps/audit-app/src/features/audit/` alongside the existing rack/machine-room features — co-located hooks (`compressor-api.ts`) + page + `.test.tsx`, per CLAUDE.md § SPA Feature Structure.
- New API files follow `routes/ ↔ services/ ↔ repositories/` with co-located `.test.ts`, per CLAUDE.md § API Structure.
- No conflicts with the unified structure. The compressor regression lookup endpoint sitting at `/api/v1/compressors/:model` (outside the `/audits/...` tree) is intentional — it is global reference data, matching the architecture's `api/routes/compressors.ts` placement [architecture.md#L789].

## Dev Agent Record

### Agent Model Used

claude-opus-4-7[1m]

### Debug Log References

- `pnpm --filter @cems/types build` — passed.
- `pnpm turbo run type-check` — 11/11 packages pass.
- `pnpm turbo run lint` — 8/8 pass, 0 warnings. (Initial run flagged 3 unused `eslint-disable react-hooks/exhaustive-deps` directives in `CompressorEntryPage.tsx` — the rule didn't fire on those effects, so the directives were removed; audit-app enforces `--max-warnings=0`.)
- New API tests green: `compressor-ref.repo.test.ts` (4), `compressor.repo.test.ts` (12), `compressor.service.test.ts` (19), `compressors.routes.test.ts` (16). Full API suite: 388 passed / 1 skipped, no regressions.
- New SPA tests green: `CompressorListPage.test.tsx` (9), `CompressorEntryPage.test.tsx` (11, incl. axe). Re-pointed `RackGeneralPage.test.tsx` passes (now asserts the `/compressors` route).
- **Pre-existing working-tree failures (NOT regressions from 3.3):** `AutoSaveIndicator.test.tsx` (1) + `useAutoSaveSection.test.ts` (2) fail in the working tree — the same uncommitted WIP Story 3.2 documented. Verified by stashing the working-tree copies of `AutoSaveIndicator.{tsx,test.tsx}` + `useAutoSaveSection.{ts,test.ts}`: the committed (HEAD) versions pass all 13 tests; the working-tree versions fail 3. Story 3.3 touches none of these files.
- Note: `rack.service.ts` / `machine-room.service.ts` / several repos were refactored in parallel during this session (fresh-transaction P2002 retry, `reset`-based rack hydration, 404→racks-list redirect). Story 3.3's only edit to that surface is re-pointing `RackGeneralPage` "Next" to `/compressors`; the parallel refactor and its tests are independent and pass.

### Completion Notes List

Story 3.3 ships the compressor regression-DB lookup, the full Compressor entity API, and the two Compressor SPA screens, continuing the guided refrigeration flow (Rack General → Compressors → Condenser).

- **Types** — `compressorSchema` + create/list/get/patch/duplicate/report schemas, `compressorRefSchema` + lookup query, and `compressorItemParamsSchema`/`compressorListParamsSchema` added to `audit.ts`; `compressorDataSchema` to `refrigeration.schema.ts`. `index.ts` already re-exports both via `export *` — no edit needed.
- **API** — `CompressorNotFoundError` (404 `compressor-not-found`) + `CompressorModelNotFoundError` (404 `compressor-model-not-found`) added to `audit-errors.ts` + `error-handler.ts`. `compressor-ref.repo.ts` queries the GLOBAL `compressor_refs` via the plain Prisma client (no RLS). `compressor.repo.ts` mirrors `rack.repo.ts` (`rackId` folded into the upsert WHERE for the cross-rack guard; `compressorRefId` written only when the body key is present; `duplicateCompressor` clears `serialNumber`, retains `compressorRefId`). `compressor.service.ts` mirrors `rack.service.ts` (AUDITOR-only writes, ownership+DRAFT checks; no P2002 retry since there's no `[rackId, compressorNumber]` unique constraint) and adds `lookupCompressorRef` (no-RLS global read) + `reportUnknownModel` (FR53 — enqueues one `cems-email-notification-low` job per ACTIVE tenant Admin with `templateId: 'compressor-model-unknown'`, idempotent via `data.unknownModelReported`, enqueue is best-effort/never blocks). `compressors.routes.ts` registers the global `GET /api/v1/compressors/:model` lookup + the 6 audit-scoped endpoints; wired into `app.ts` after `registerRacksRoutes`.
- **SPA** — `compressor-api.ts` clones `useAutoSaveRack` (PATCH body also carries `compressorRefId`) and adds `useCompressors`/`useCompressor`/`useCreateCompressor`/`useDuplicateCompressor`/`useReportUnknownModel`/`useCompressorRefLookup` (`retry: false` so a 404 is a clean branch). `CompressorListPage` shows per-compressor completion chips with Add / Duplicate / Next (→ condenser). `CompressorEntryPage` debounces (600 ms) the model number into the lookup, auto-populates Make/Refrigerant/Capacity/EER on a match (skipping the hydration lookup so saved overrides aren't clobbered), shows the amber not-found alert on 404, persists the `compressorRefId` link via auto-save, and on "Next" notifies Admins for unknown models before navigating to the compressor list.
- **Routing** — `App.tsx` replaces the Story 3.2 `pipe-headers` stub with the Compressor List + Compressor Entry routes plus a `condenser` stub for Story 3.4; `RackGeneralPage` "Next" re-pointed to `/compressors`.
- **Seed** — `seed-test-users.ts` upserts 4 GLOBAL `compressor_refs` (Copeland/Bitzer/Carlyle, db version `1.0`) so the auto-populate path is exercisable locally.

All 15 ACs satisfied. Touch targets use `min-h-[48px]`; redirect guards cover direct-URL access when no machine room exists. 71 new tests added (51 API, 20 SPA + axe).

### File List

**Added**
- `apps/api/src/repositories/compressor-ref.repo.ts`
- `apps/api/src/repositories/compressor-ref.repo.test.ts`
- `apps/api/src/repositories/compressor.repo.ts`
- `apps/api/src/repositories/compressor.repo.test.ts`
- `apps/api/src/services/compressor.service.ts`
- `apps/api/src/services/compressor.service.test.ts`
- `apps/api/src/routes/compressors.routes.ts`
- `apps/api/src/routes/compressors.routes.test.ts`
- `apps/audit-app/src/features/audit/compressor-api.ts`
- `apps/audit-app/src/features/audit/CompressorListPage.tsx`
- `apps/audit-app/src/features/audit/CompressorListPage.test.tsx`
- `apps/audit-app/src/features/audit/CompressorEntryPage.tsx`
- `apps/audit-app/src/features/audit/CompressorEntryPage.test.tsx`

**Modified**
- `packages/types/src/audit.ts`
- `packages/types/src/forms/refrigeration.schema.ts`
- `apps/api/src/lib/audit-errors.ts`
- `apps/api/src/middleware/error-handler.ts`
- `apps/api/src/app.ts`
- `apps/audit-app/src/App.tsx`
- `apps/audit-app/src/features/audit/RackGeneralPage.tsx`
- `apps/audit-app/src/features/audit/RackGeneralPage.test.tsx`
- `packages/db/scripts/seed-test-users.ts`
- `docs/bmad/_bmad-output/implementation-artifacts/sprint-status.yaml`

## Change Log

| Date       | Change |
|------------|--------|
| 2026-05-22 | Story created via create-story from epic-03 Story 3.3 ACs + Story 3.2 rack-trio patterns + architecture/PRD compressor-DB context. |
| 2026-05-23 | Implemented Story 3.3 — compressor regression-DB lookup endpoint, Compressor entity API (CRUD + duplicate + FR53 report-unknown-model), Compressor List + Compressor Entry SPA screens with model auto-populate / amber not-found alert, Rack General re-point + App.tsx routing, dev seed. All 15 ACs satisfied; 71 new tests. |
