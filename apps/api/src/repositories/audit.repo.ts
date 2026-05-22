import type {
  AuditDetail,
  AuditListItem,
  AuditSectionState,
  CreateAuditResponse,
  SectionId,
} from '@cems/types'
import { AuditStatus, SECTION_IDS } from '@cems/types'
import { AuditNotEditableError } from '../lib/audit-errors.js'

function normalizeSectionId(raw: string | null): SectionId | null {
  if (raw == null) return null
  return (SECTION_IDS as readonly string[]).includes(raw) ? (raw as SectionId) : null
}

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
  /** Required by the atomic update predicate (P2 fix). Without it the
   *  `audit.update` would succeed even after the audit was reassigned to
   *  another auditor mid-request. */
  auditorUserId: string
  sectionId: SectionId
  data: Record<string, unknown>
}

interface AuditRow {
  id: string
  storeId: string | null
  status: string
  createdAt: Date
  updatedAt: Date
  store: { storeNumber: string } | null
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
      store: { select: { storeNumber: true } },
    },
    orderBy: { updatedAt: 'desc' },
    take,
  })
  const audits = rows.map<AuditListItem>((row) => ({
    id: row.id,
    storeId: row.storeId,
    storeNumber: row.store?.storeNumber ?? null,
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
 * Auto-save upsert. Single RLS-scoped transaction: (1) atomically bump
 * `audits.current_section_id` + `audits.updated_at` USING a composite
 * where-clause (id + auditorUserId + status='DRAFT') so a concurrent
 * reassignment or status-flip cannot slip through; (2) upsert the
 * audit_sections row. Returns the audit's resulting updatedAt as savedAt.
 *
 * Story 2.3 P2 fix — folds the ownership/DRAFT check into the update
 * predicate so the previous TOCTOU window (separate read + write) is closed.
 * Prisma surfaces a missed predicate as P2025 → `AuditNotEditableError`.
 */
export async function upsertAuditSection(
  tx: PrismaLike,
  input: UpsertAuditSectionInput,
): Promise<{ savedAt: string }> {
  let updated: { updatedAt: Date }
  try {
    updated = await tx.audit.update({
      where: {
        id: input.auditId,
        auditorUserId: input.auditorUserId,
        status: AuditStatus.DRAFT,
      },
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
    auditorUserId: row.auditorUserId,
    status: row.status as AuditStatus,
    // Normalise unknown values (older client / future story) to null so
    // the SPA falls back gracefully instead of routing to a 404 stub.
    currentSectionId: normalizeSectionId(row.currentSectionId),
    formVersion: row.formVersion,
    compressorDbVersion: row.compressorDbVersion,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    sections,
  }
}

/**
 * Returns the most-recent DRAFT audit owned by a specific auditor, or
 * null. Used by `createAuditDraft` to enforce the one-DRAFT-per-auditor
 * invariant (Story 2.3 P16). RLS already scopes the read to the caller's
 * tenant.
 */
export async function findActiveDraftForAuditor(
  tx: PrismaLike,
  auditorUserId: string,
): Promise<{ id: string; storeId: string } | null> {
  const row: { id: string; storeId: string } | null = await tx.audit.findFirst({
    where: { auditorUserId, status: AuditStatus.DRAFT },
    select: { id: true, storeId: true },
    orderBy: { updatedAt: 'desc' },
  })
  return row
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
