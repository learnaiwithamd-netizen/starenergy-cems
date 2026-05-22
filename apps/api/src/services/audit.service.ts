import type { FastifyRequest } from 'fastify'
import {
  AuditStatus,
  UserRole,
  type AuditDetail,
  type CreateAuditBody,
  type CreateAuditResponse,
  type ListAuditsQuery,
  type PatchAuditSectionBody,
  type PatchAuditSectionParams,
  type PatchAuditSectionResponse,
} from '@cems/types'
import { RoleNotPermittedError } from '../lib/auth-errors.js'
import {
  AuditNotFoundError,
  DraftAlreadyExistsError,
  StoreNotAssignedError,
  StoreNotFoundError,
} from '../lib/audit-errors.js'
import {
  createAudit,
  findActiveDraftForAuditor,
  getAuditById,
  getLatestCompressorDbVersion,
  listAuditsForCaller as listAuditsRepo,
  upsertAuditSection,
  type ListAuditsResult,
} from '../repositories/audit.repo.js'

// Bumped when the audit form schema changes in a breaking way.
const CURRENT_FORM_VERSION = '1.0'

export interface ServiceContext {
  request: FastifyRequest
}

/**
 * Creates a DRAFT audit for an AUDITOR caller. Rejects any other role with 403.
 *
 * Story 2.3 patches:
 * - **P15** AUDITOR may only start an audit on a store in their
 *   `assignedStoreIds` (least-privilege, matches Store Selector UX).
 * - **P16** AUDITOR is limited to one DRAFT at a time; a second create
 *   raises `DraftAlreadyExistsError` (409 with the existing draft's
 *   id + storeId). Site-switch mid-draft requires admin reassignment
 *   (future story).
 *
 * `clientId` mirrors `tenantId` until a multi-client model is introduced.
 * `compressorDbVersion` is resolved from the latest row in compressor_refs
 * (falls back to "1.0" when the table is empty, e.g. in dev seeding).
 */
export async function createAuditDraft(
  body: CreateAuditBody,
  ctx: ServiceContext,
): Promise<CreateAuditResponse> {
  const rls = ctx.request.rlsContext
  if (!rls) throw new Error('createAuditDraft requires an authenticated request')
  if (rls.role !== UserRole.AUDITOR) throw new RoleNotPermittedError()

  const assignedStoreIds = rls.assignedStoreIds ?? []
  if (!assignedStoreIds.includes(body.storeId)) {
    throw new StoreNotAssignedError()
  }

  return ctx.request.withRls(async (tx) => {
    const existing = await findActiveDraftForAuditor(tx, rls.userId)
    if (existing) {
      throw new DraftAlreadyExistsError(existing.id, existing.storeId)
    }
    const storeExists = await tx.storeRef.findUnique({ where: { id: body.storeId }, select: { id: true } })
    if (!storeExists) throw new StoreNotFoundError()
    const compressorDbVersion = await getLatestCompressorDbVersion(tx)
    return createAudit(tx, {
      tenantId: rls.tenantId,
      clientId: rls.tenantId,
      storeId: body.storeId,
      auditorUserId: rls.userId,
      formVersion: CURRENT_FORM_VERSION,
      compressorDbVersion,
    })
  })
}

/**
 * Auto-save a section's form data (Story 2.3). AUDITOR-only. Ownership +
 * DRAFT-status are enforced atomically in the repo's `audit.update`
 * where-clause (Story 2.3 P2 fix) — Prisma returns P2025 → repo wraps
 * as `AuditNotEditableError` (uniform 404, no existence leak).
 */
export async function patchAuditSection(
  params: PatchAuditSectionParams,
  body: PatchAuditSectionBody,
  ctx: ServiceContext,
): Promise<PatchAuditSectionResponse> {
  const rls = ctx.request.rlsContext
  if (!rls) throw new Error('patchAuditSection requires an authenticated request')
  if (rls.role !== UserRole.AUDITOR) throw new RoleNotPermittedError()

  return ctx.request.withRls(async (tx) => {
    const { savedAt } = await upsertAuditSection(tx, {
      tenantId: rls.tenantId,
      auditId: params.id,
      auditorUserId: rls.userId,
      sectionId: params.sectionId,
      data: body.data,
    })
    return { sectionId: params.sectionId, savedAt }
  })
}

/**
 * Returns the full audit detail (incl. all section rows) for a single
 * audit. Azure SQL RLS scopes visibility by tenant + CLIENT-store gating,
 * but does NOT auto-filter audits by authoring auditor. So for an AUDITOR
 * caller, the service additionally asserts the caller owns the audit
 * (Story 2.3 P14 fix — closes cross-auditor info disclosure within tenant).
 *
 * Null repo result OR an AUDITOR caller viewing a peer's audit both
 * surface as `AuditNotFoundError` (uniform 404, no existence leak).
 */
export async function getAuditDetail(
  auditId: string,
  ctx: ServiceContext,
): Promise<AuditDetail> {
  const rls = ctx.request.rlsContext
  if (!rls) throw new Error('getAuditDetail requires an authenticated request')

  const detail = await ctx.request.withRls((tx) => getAuditById(tx, auditId))
  if (!detail) throw new AuditNotFoundError()
  if (rls.role === UserRole.AUDITOR && detail.auditorUserId !== rls.userId) {
    throw new AuditNotFoundError()
  }
  return detail
}

/**
 * List audits visible to the caller, with optional `status` and
 * `auditorId` filters. Used by the resume flow (`?status=DRAFT&
 * auditorId=me`) and by future admin queue work.
 *
 * AUDITOR callers may only filter by their own `userId` — passing any
 * other value or omitting `auditorId` is ALLOWED but silently scoped to
 * `rls.userId` to avoid cross-auditor enumeration. (The Azure SQL RLS
 * predicate scopes by tenant + CLIENT-store but does NOT auto-filter by
 * authoring auditor; the service is the single source of truth here.)
 *
 * ADMIN may filter by any `auditorId`. CLIENT's `auditorId` value is
 * ignored (CLIENT queries are about audits-for-my-stores, not by-author).
 */
export async function listAudits(
  query: ListAuditsQuery,
  ctx: ServiceContext,
): Promise<ListAuditsResult> {
  const rls = ctx.request.rlsContext
  if (!rls) throw new Error('listAudits requires an authenticated request')

  const repoOpts: { status?: AuditStatus; auditorUserId?: string } = {}
  if (query.status !== undefined) repoOpts.status = query.status

  if (rls.role === UserRole.AUDITOR) {
    repoOpts.auditorUserId = rls.userId
  } else if (rls.role === UserRole.ADMIN && query.auditorId !== undefined) {
    repoOpts.auditorUserId = query.auditorId === 'me' ? rls.userId : query.auditorId
  } else if (rls.role === UserRole.CLIENT) {
    // Ignore auditorId for CLIENTs — they query by tenant/store via RLS.
  }

  return ctx.request.withRls((tx) => listAuditsRepo(tx, repoOpts))
}
