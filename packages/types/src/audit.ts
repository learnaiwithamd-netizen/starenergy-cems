import { z } from 'zod'

export enum AuditStatus {
  DRAFT = 'DRAFT',
  SUBMITTED = 'SUBMITTED',
  IN_REVIEW = 'IN_REVIEW',
  CALC_IN_PROGRESS = 'CALC_IN_PROGRESS',
  CALC_COMPLETE = 'CALC_COMPLETE',
  MANUAL_REVIEW_REQUIRED = 'MANUAL_REVIEW_REQUIRED',
  APPROVED = 'APPROVED',
  PUBLISHED = 'PUBLISHED',
}

export interface Audit {
  id: string
  tenantId: string
  storeNumber: string
  status: AuditStatus
  formVersion: string
  compressorDbVersion: string
  currentSectionId: string | null
  createdAt: string
  updatedAt: string
}

export interface AuditSection {
  id: string
  auditId: string
  sectionId: string
  data: Record<string, unknown>
  completedAt: string | null
}

// ─── Audit list shape (Story 1.4 stub; Epic 2 + Story 7.1 widen) ───────
// Minimal shape returned by the GET /api/v1/audits stub. Future stories
// extend this via .extend(...) (e.g., adding ECM savings, calc state,
// SLA timer fields). DO NOT replace — extend.
export const auditListItemSchema = z.object({
  id: z.string().min(1),
  storeId: z.string().min(1).nullable(),
  /** Human-readable store identifier — joined from `store_refs` server-side.
   *  Used by the Resume CTA on the audit-app store selector to label the
   *  draft even when the auditor's assigned-stores list no longer contains
   *  the draft's store. (Story 2.3 P13 fix.) */
  storeNumber: z.string().min(1).nullable().optional(),
  status: z.nativeEnum(AuditStatus),
  createdAt: z.string(),
  updatedAt: z.string(),
})
export type AuditListItem = z.infer<typeof auditListItemSchema>

export const listAuditsResponseSchema = z.object({
  audits: z.array(auditListItemSchema),
  total: z.number().int().min(0),
})
export type ListAuditsResponse = z.infer<typeof listAuditsResponseSchema>

// ─── Story 2.2 — DRAFT audit creation ───────────────────────────────────

export const createAuditBodySchema = z.object({
  storeId: z.string().min(1),
})
export type CreateAuditBody = z.infer<typeof createAuditBodySchema>

export const createAuditResponseSchema = z.object({
  auditId: z.string().min(1),
})
export type CreateAuditResponse = z.infer<typeof createAuditResponseSchema>

// ─── Story 2.3 — Auto-save & resume ─────────────────────────────────────

export const SECTION_IDS = [
  'general',
  'refrigeration',
  'hvac',
  'lighting',
  'building-envelope',
] as const
export type SectionId = (typeof SECTION_IDS)[number]
export const sectionIdSchema = z.enum(SECTION_IDS)

export const patchAuditSectionParamsSchema = z.object({
  id: z.string().min(1),
  sectionId: sectionIdSchema,
})
export type PatchAuditSectionParams = z.infer<typeof patchAuditSectionParamsSchema>

export const patchAuditSectionBodySchema = z.object({
  data: z.record(z.unknown()),
})
export type PatchAuditSectionBody = z.infer<typeof patchAuditSectionBodySchema>

export const patchAuditSectionResponseSchema = z.object({
  sectionId: sectionIdSchema,
  savedAt: z.string(),
})
export type PatchAuditSectionResponse = z.infer<typeof patchAuditSectionResponseSchema>

export const auditSectionStateSchema = z.object({
  sectionId: sectionIdSchema,
  data: z.record(z.unknown()),
  completedAt: z.string().nullable(),
  updatedAt: z.string(),
})
export type AuditSectionState = z.infer<typeof auditSectionStateSchema>

export const auditDetailSchema = z.object({
  id: z.string().min(1),
  storeId: z.string().min(1),
  /** Carrying `auditorUserId` on the detail payload lets the SPA fail closed
   *  if a previously cached query somehow surfaces a peer auditor's audit;
   *  the server also asserts this for AUDITOR callers (Story 2.3 P14). */
  auditorUserId: z.string().min(1).nullable(),
  status: z.nativeEnum(AuditStatus),
  currentSectionId: sectionIdSchema.nullable(),
  formVersion: z.string(),
  compressorDbVersion: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  sections: z.array(auditSectionStateSchema),
})
export type AuditDetail = z.infer<typeof auditDetailSchema>

/**
 * Query schema for `GET /api/v1/audits`. Both filters are optional.
 * `auditorId='me'` is the documented sentinel — the API resolves it to
 * `rls.userId` server-side. AUDITOR callers MUST pass either `'me'` or
 * their own user id (defense in depth — RLS does not auto-filter audits
 * to the caller's authored set, only to the caller's tenant + assigned
 * stores for CLIENT).
 */
export const listAuditsQuerySchema = z.object({
  status: z.nativeEnum(AuditStatus).optional(),
  auditorId: z.string().min(1).optional(),
})
export type ListAuditsQuery = z.infer<typeof listAuditsQuerySchema>

// ─── Story 3.1 — Machine Room entity schemas ─────────────────────────────────

export const rackEntrySchema = z.object({
  rackName: z.string().optional(),
  suctionGroupNumber: z.string().optional(),
  suctionGroupType: z.enum(['Low Temp.', 'Medium Temp.', 'Dual Temp.']).optional(),
})
export type RackEntry = z.infer<typeof rackEntrySchema>

export const mrGeneralDataSchema = z.object({
  machineRoomId: z.string().min(1),
  location: z.enum(['Mezzanine', 'Penthouse', 'Main floor', 'Other']).optional(),
  racks: z.array(rackEntrySchema).min(1),
})
export type MrGeneralData = z.infer<typeof mrGeneralDataSchema>

export const mrVentilationDataSchema = z.object({
  ventilationType: z.enum(['Forced', 'Natural']),
  connectedToExhaust: z.enum(['Yes', 'No']).optional(),
  setPointOn: z.number().optional(),
  setPointOff: z.number().optional(),
  controlBy: z.enum(['Thermostat', 'None']).optional(),
})
export type MrVentilationData = z.infer<typeof mrVentilationDataSchema>

export const machineRoomDataSchema = z.object({
  general: mrGeneralDataSchema.optional(),
  ventilation: mrVentilationDataSchema.optional(),
})
export type MachineRoomData = z.infer<typeof machineRoomDataSchema>

export const machineRoomSchema = z.object({
  id: z.string(),
  tenantId: z.string().optional(),
  auditId: z.string(),
  roomNumber: z.string(),
  data: z.record(z.unknown()),
  createdAt: z.string(),
  updatedAt: z.string(),
})
export type MachineRoom = z.infer<typeof machineRoomSchema>

export const createMachineRoomBodySchema = z.object({
  roomNumber: z.string().default('1'),
})
export type CreateMachineRoomBody = z.infer<typeof createMachineRoomBodySchema>

export const createMachineRoomResponseSchema = machineRoomSchema
export type CreateMachineRoomResponse = MachineRoom

export const patchMachineRoomParamsSchema = z.object({
  auditId: z.string().min(1),
  roomId: z.string().min(1),
})
export type PatchMachineRoomParams = z.infer<typeof patchMachineRoomParamsSchema>

export const patchMachineRoomBodySchema = z.object({
  data: z.record(z.unknown()),
})
export type PatchMachineRoomBody = z.infer<typeof patchMachineRoomBodySchema>

export const patchMachineRoomResponseSchema = z.object({
  savedAt: z.string(),
  roomId: z.string(),
})
export type PatchMachineRoomResponse = z.infer<typeof patchMachineRoomResponseSchema>

export const listMachineRoomsResponseSchema = z.object({
  machineRooms: z.array(machineRoomSchema),
})
export type ListMachineRoomsResponse = z.infer<typeof listMachineRoomsResponseSchema>

// ─── Story 3.2 — Rack entity schemas ─────────────────────────────────────────

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

// ─── Compressor entity (Story 3.3) ───────────────────────────────────────────
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

/** Params for create/list (no compressorId). */
export const compressorListParamsSchema = z.object({
  auditId: z.string().min(1),
  roomId: z.string().min(1),
  rackId: z.string().min(1),
})
export type CompressorListParams = z.infer<typeof compressorListParamsSchema>

/** Params for get/patch/duplicate/report (with compressorId). */
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

// ─── Compressor regression-DB lookup (Story 3.3) ──────────────────────────────
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
