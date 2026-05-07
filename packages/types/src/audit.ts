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
