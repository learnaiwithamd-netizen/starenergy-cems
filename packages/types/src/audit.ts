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
