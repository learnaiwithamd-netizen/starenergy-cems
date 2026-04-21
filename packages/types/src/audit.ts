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
