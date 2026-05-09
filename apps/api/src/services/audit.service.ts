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
import { AuditNotEditableError, AuditNotFoundError, StoreNotFoundError } from '../lib/audit-errors.js'
import {
  createAudit,
  getAuditById,
  getAuditOwnership,
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

  return ctx.request.withRls(async (tx) => {
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
 * Auto-save a section's form data (Story 2.3). AUDITOR-only. The caller
 * must own the audit (auditorUserId match) and the audit must still be
 * DRAFT. Any of those three checks failing throws `AuditNotEditableError`
 * with a uniform message — we don't distinguish reasons to avoid leaking
 * existence/ownership signals.
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
    const ownership = await getAuditOwnership(tx, params.id)
    if (
      !ownership ||
      ownership.auditorUserId !== rls.userId ||
      ownership.status !== AuditStatus.DRAFT
    ) {
      throw new AuditNotEditableError()
    }

    const { savedAt } = await upsertAuditSection(tx, {
      tenantId: rls.tenantId,
      auditId: params.id,
      sectionId: params.sectionId,
      data: body.data,
    })
    return { sectionId: params.sectionId, savedAt }
  })
}

/**
 * Returns the full audit detail (incl. all section rows) for a single
 * audit. Auth-required for any role; Azure SQL RLS does the visibility
 * scoping (tenant + CLIENT-store gating). Null repo result → 404.
 */
export async function getAuditDetail(
  auditId: string,
  ctx: ServiceContext,
): Promise<AuditDetail> {
  const rls = ctx.request.rlsContext
  if (!rls) throw new Error('getAuditDetail requires an authenticated request')

  const detail = await ctx.request.withRls((tx) => getAuditById(tx, auditId))
  if (!detail) throw new AuditNotFoundError()
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
