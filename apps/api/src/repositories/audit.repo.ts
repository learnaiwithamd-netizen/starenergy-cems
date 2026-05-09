import type {
  AuditDetail,
  AuditListItem,
  AuditSectionState,
  CreateAuditResponse,
  SectionId,
} from '@cems/types'
import { AuditStatus } from '@cems/types'
import { AuditNotEditableError } from '../lib/audit-errors.js'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PrismaLike = any

export interface ListAuditsResult {
  audits: AuditListItem[]
  total: number
}

export interface ListAuditsInput {
  take?: number
  status?: AuditStatus
  auditorUserId?: string
}

export interface CreateAuditInput {
  tenantId: string
  clientId: string
  storeId: string
  auditorUserId: string
  formVersion: string
  compressorDbVersion: string
}

export interface UpsertAuditSectionInput {
  tenantId: string
  auditId: string
  sectionId: SectionId
  data: Record<string, unknown>
}

interface AuditRow {
  id: string
  storeId: string | null
  status: string
  createdAt: Date
  updatedAt: Date
}

interface AuditDetailRow {
  id: string
  storeId: string
  auditorUserId: string | null
  status: string
  currentSectionId: string | null
  formVersion: string
  compressorDbVersion: string
  createdAt: Date
  updatedAt: Date
  sections: Array<{
    sectionId: string
    data: string
    completedAt: Date | null
    updatedAt: Date
  }>
}

/**
 * RLS-scoped audit list. Caller passes the tx from `request.withRls(...)`
 * so Azure SQL's `security.fn_audits_filter` enforces tenant + CLIENT
 * store-scoping at the DB layer.
 *
 * Story 2.3 extends the 1.4 stub with optional `status` and
 * `auditorUserId` filters. Sort is `updatedAt desc` so resume picks the
 * most-recently-touched draft.
 */
export async function listAuditsForCaller(
  tx: PrismaLike,
  opts: ListAuditsInput = {},
): Promise<ListAuditsResult> {
  const take = opts.take ?? 50
  const where: Record<string, unknown> = {}
  if (opts.status !== undefined) where['status'] = opts.status
  if (opts.auditorUserId !== undefined) where['auditorUserId'] = opts.auditorUserId

  const rows: AuditRow[] = await tx.audit.findMany({
    where,
    select: {
      id: true,
      storeId: true,
      status: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: { updatedAt: 'desc' },
    take,
  })
  const audits = rows.map<AuditListItem>((row) => ({
    id: row.id,
    storeId: row.storeId,
    status: row.status as AuditStatus,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }))
  return { audits, total: audits.length }
}

export async function createAudit(
  tx: PrismaLike,
  input: CreateAuditInput,
): Promise<CreateAuditResponse> {
  const audit = await tx.audit.create({
    data: {
      tenantId: input.tenantId,
      clientId: input.clientId,
      storeId: input.storeId,
      auditorUserId: input.auditorUserId,
      status: AuditStatus.DRAFT,
      currentSectionId: 'general',
      formVersion: input.formVersion,
      compressorDbVersion: input.compressorDbVersion,
    },
    select: { id: true },
  })
  return { auditId: audit.id }
}

export async function getLatestCompressorDbVersion(tx: PrismaLike): Promise<string> {
  const latest = await tx.compressorRef.findFirst({
    select: { compressorDbVersion: true },
    orderBy: { createdAt: 'desc' },
  })
  return latest?.compressorDbVersion ?? '1.0'
}

/**
 * Owner + status check before mutation. Returns the audit's auditorUserId
 * + status when the row exists in the RLS-scoped tenant; null otherwise.
 * The service layer makes the editability decision; the repo just reads.
 */
export async function getAuditOwnership(
  tx: PrismaLike,
  auditId: string,
): Promise<{ auditorUserId: string | null; status: AuditStatus } | null> {
  const row: { auditorUserId: string | null; status: string } | null = await tx.audit.findUnique({
    where: { id: auditId },
    select: { auditorUserId: true, status: true },
  })
  if (!row) return null
  return { auditorUserId: row.auditorUserId, status: row.status as AuditStatus }
}

/**
 * Auto-save upsert. Single transaction: (1) bump audits.current_section_id
 * + audits.updated_at by writing to audit; (2) upsert audit_sections row
 * keyed by (auditId, sectionId). Returns the audit's resulting updatedAt
 * as savedAt — the SPA shows it in the offline banner ("last saved Xm ago").
 */
export async function upsertAuditSection(
  tx: PrismaLike,
  input: UpsertAuditSectionInput,
): Promise<{ savedAt: string }> {
  let updated: { updatedAt: Date }
  try {
    updated = await tx.audit.update({
      where: { id: input.auditId },
      data: { currentSectionId: input.sectionId },
      select: { updatedAt: true },
    })
  } catch (err: unknown) {
    if (
      err != null &&
      typeof err === 'object' &&
      'code' in err &&
      (err as { code: unknown }).code === 'P2025'
    ) {
      throw new AuditNotEditableError()
    }
    throw err
  }
  await tx.auditSection.upsert({
    where: {
      auditId_sectionId: {
        auditId: input.auditId,
        sectionId: input.sectionId,
      },
    },
    create: {
      tenantId: input.tenantId,
      auditId: input.auditId,
      sectionId: input.sectionId,
      data: JSON.stringify(input.data),
    },
    update: {
      data: JSON.stringify(input.data),
    },
  })
  return { savedAt: updated.updatedAt.toISOString() }
}

/**
 * Full audit detail incl. all section rows. Used by the resume flow to
 * pre-fill section forms. RLS scopes by tenant + (for CLIENTs) by
 * assigned-store-ids — auditors see only their tenant's audits.
 */
export async function getAuditById(
  tx: PrismaLike,
  auditId: string,
): Promise<AuditDetail | null> {
  const row: AuditDetailRow | null = await tx.audit.findUnique({
    where: { id: auditId },
    select: {
      id: true,
      storeId: true,
      auditorUserId: true,
      status: true,
      currentSectionId: true,
      formVersion: true,
      compressorDbVersion: true,
      createdAt: true,
      updatedAt: true,
      sections: {
        select: {
          sectionId: true,
          data: true,
          completedAt: true,
          updatedAt: true,
        },
      },
    },
  })
  if (!row) return null
  const sections: AuditSectionState[] = row.sections.map((s) => ({
    sectionId: s.sectionId as SectionId,
    data: parseSectionData(s.data),
    completedAt: s.completedAt ? s.completedAt.toISOString() : null,
    updatedAt: s.updatedAt.toISOString(),
  }))
  return {
    id: row.id,
    storeId: row.storeId,
    status: row.status as AuditStatus,
    currentSectionId: row.currentSectionId as SectionId | null,
    formVersion: row.formVersion,
    compressorDbVersion: row.compressorDbVersion,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    sections,
  }
}

function parseSectionData(raw: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(raw) as unknown
    if (parsed != null && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>
    }
  } catch {
    // fall through
  }
  return {}
}
