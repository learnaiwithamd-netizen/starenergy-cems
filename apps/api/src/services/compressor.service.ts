import type { FastifyRequest } from 'fastify'
import {
  AuditStatus,
  UserRole,
  type Compressor,
  type CompressorRef,
  type PatchCompressorBody,
  type ReportUnknownModelResponse,
} from '@cems/types'
import { prisma } from '@cems/db'
import { RoleNotPermittedError } from '../lib/auth-errors.js'
import {
  AuditNotEditableError,
  CompressorModelNotFoundError,
  CompressorNotFoundError,
} from '../lib/audit-errors.js'
import { getAuditOwnership } from '../repositories/audit.repo.js'
import { listUsersByRole } from '../repositories/user.repo.js'
import { getEmailNotificationQueue } from '../jobs/queue.js'
import { findCompressorRefByModel } from '../repositories/compressor-ref.repo.js'
import {
  createCompressor as createCompressorRepo,
  duplicateCompressor as duplicateCompressorRepo,
  getCompressorById as getCompressorByIdRepo,
  getCompressorsByRackId,
  upsertCompressorData,
} from '../repositories/compressor.repo.js'

export interface ServiceContext {
  request: FastifyRequest
}

/**
 * Create a compressor under a rack. AUDITOR-only; caller must own a DRAFT audit.
 * `compressorNumber` = (existing count + 1). No P2002 retry — there is no
 * `[rackId, compressorNumber]` unique constraint.
 */
export async function createCompressor(
  { rackId, auditId }: { rackId: string; machineRoomId: string; auditId: string },
  ctx: ServiceContext,
): Promise<Compressor> {
  const rls = ctx.request.rlsContext
  if (!rls) throw new Error('createCompressor requires an authenticated request')
  if (rls.role !== UserRole.AUDITOR) throw new RoleNotPermittedError()

  return ctx.request.withRls(async (tx) => {
    const ownership = await getAuditOwnership(tx, auditId)
    if (!ownership || ownership.auditorUserId !== rls.userId || ownership.status !== AuditStatus.DRAFT) {
      throw new AuditNotEditableError()
    }

    const compressors = await getCompressorsByRackId(tx, { rackId })
    return createCompressorRepo(tx, {
      tenantId: rls.tenantId,
      rackId,
      compressorNumber: String(compressors.length + 1),
    })
  })
}

/** List all compressors for a rack. Any authenticated role (RLS scopes by tenant). */
export async function getCompressors(
  { rackId }: { rackId: string; machineRoomId: string; auditId: string },
  ctx: ServiceContext,
): Promise<Compressor[]> {
  const rls = ctx.request.rlsContext
  if (!rls) throw new Error('getCompressors requires an authenticated request')

  return ctx.request.withRls((tx) => getCompressorsByRackId(tx, { rackId }))
}

/** Fetch a single compressor. Any authenticated role; throws CompressorNotFoundError if missing. */
export async function getCompressorById(
  { compressorId, rackId }: { compressorId: string; rackId: string; machineRoomId: string; auditId: string },
  ctx: ServiceContext,
): Promise<Compressor> {
  const rls = ctx.request.rlsContext
  if (!rls) throw new Error('getCompressorById requires an authenticated request')

  return ctx.request.withRls(async (tx) => {
    const compressor = await getCompressorByIdRepo(tx, { id: compressorId })
    if (!compressor || compressor.rackId !== rackId) throw new CompressorNotFoundError()
    return compressor
  })
}

/**
 * Patch compressor data. AUDITOR-only; caller must own a DRAFT audit. The
 * `compressorRefId` column is only written when the body carried the key
 * (preserves "set to null" vs "not provided").
 */
export async function patchCompressor(
  {
    compressorId,
    rackId,
    auditId,
    body,
  }: { compressorId: string; rackId: string; machineRoomId: string; auditId: string; body: PatchCompressorBody },
  ctx: ServiceContext,
): Promise<{ savedAt: string; compressorId: string }> {
  const rls = ctx.request.rlsContext
  if (!rls) throw new Error('patchCompressor requires an authenticated request')
  if (rls.role !== UserRole.AUDITOR) throw new RoleNotPermittedError()

  return ctx.request.withRls(async (tx) => {
    const ownership = await getAuditOwnership(tx, auditId)
    if (!ownership || ownership.auditorUserId !== rls.userId || ownership.status !== AuditStatus.DRAFT) {
      throw new AuditNotEditableError()
    }

    if ('compressorRefId' in body) {
      return upsertCompressorData(tx, {
        id: compressorId,
        rackId,
        tenantId: rls.tenantId,
        data: body.data,
        compressorRefId: body.compressorRefId ?? null,
      })
    }
    return upsertCompressorData(tx, { id: compressorId, rackId, tenantId: rls.tenantId, data: body.data })
  })
}

/**
 * Duplicate a compressor. AUDITOR-only; caller must own a DRAFT audit. The new
 * compressor copies the source's data + compressorRefId minus serialNumber.
 */
export async function duplicateCompressor(
  { compressorId, rackId, auditId }: { compressorId: string; rackId: string; machineRoomId: string; auditId: string },
  ctx: ServiceContext,
): Promise<Compressor> {
  const rls = ctx.request.rlsContext
  if (!rls) throw new Error('duplicateCompressor requires an authenticated request')
  if (rls.role !== UserRole.AUDITOR) throw new RoleNotPermittedError()

  return ctx.request.withRls(async (tx) => {
    const ownership = await getAuditOwnership(tx, auditId)
    if (!ownership || ownership.auditorUserId !== rls.userId || ownership.status !== AuditStatus.DRAFT) {
      throw new AuditNotEditableError()
    }

    const compressors = await getCompressorsByRackId(tx, { rackId })
    return duplicateCompressorRepo(tx, {
      sourceId: compressorId,
      rackId,
      tenantId: rls.tenantId,
      compressorNumber: String(compressors.length + 1),
    })
  })
}

/**
 * Look up a compressor model in the GLOBAL regression DB. No RLS / no ownership —
 * `compressor_refs` is reference data; role-gating happens at the route layer.
 * Throws CompressorModelNotFoundError (→ 404) when the model is unknown, which
 * drives the SPA's manual-entry + Admin-notification path (FR45).
 */
export async function lookupCompressorRef({
  model,
  version,
}: {
  model: string
  version?: string
}): Promise<CompressorRef> {
  const ref = await findCompressorRefByModel(prisma, { modelNumber: model, version })
  if (!ref) throw new CompressorModelNotFoundError()
  return ref
}

/**
 * FR53 — alert tenant Admins that an Auditor entered a compressor model not in
 * the regression DB. AUDITOR-only; caller must own a DRAFT audit. Idempotent: a
 * `data.unknownModelReported` flag short-circuits repeat calls so revisiting the
 * screen does not re-notify. Enqueue is best-effort — a queue failure is logged,
 * never thrown (the Auditor must not be blocked); the flag is still written.
 */
export async function reportUnknownModel(
  { compressorId, rackId, auditId }: { compressorId: string; rackId: string; machineRoomId: string; auditId: string },
  ctx: ServiceContext,
): Promise<ReportUnknownModelResponse> {
  const rls = ctx.request.rlsContext
  if (!rls) throw new Error('reportUnknownModel requires an authenticated request')
  if (rls.role !== UserRole.AUDITOR) throw new RoleNotPermittedError()

  return ctx.request.withRls(async (tx) => {
    const ownership = await getAuditOwnership(tx, auditId)
    if (!ownership || ownership.auditorUserId !== rls.userId || ownership.status !== AuditStatus.DRAFT) {
      throw new AuditNotEditableError()
    }

    const compressor = await getCompressorByIdRepo(tx, { id: compressorId })
    if (!compressor || compressor.rackId !== rackId) throw new CompressorNotFoundError()

    if (compressor.data['unknownModelReported'] === true) {
      return { reported: false, alreadyReported: true }
    }

    const general = compressor.data['general'] as { modelNumber?: string } | undefined
    const modelNumber = general?.modelNumber ?? ''

    const { users: admins } = await listUsersByRole(tx, { role: UserRole.ADMIN, status: 'ACTIVE' })

    let adminsNotified = 0
    try {
      const queue = getEmailNotificationQueue()
      for (const admin of admins) {
        await queue.add('compressor-model-unknown', {
          to: admin.email,
          templateId: 'compressor-model-unknown',
          variables: { modelNumber, auditId, rackId, compressorId },
          tenantId: rls.tenantId,
          auditId,
        })
        adminsNotified += 1
      }
    } catch (err) {
      ctx.request.log.error({ err }, 'reportUnknownModel: failed to enqueue admin notification(s)')
    }

    await upsertCompressorData(tx, {
      id: compressorId,
      rackId,
      tenantId: rls.tenantId,
      data: {
        ...compressor.data,
        unknownModelReported: true,
        unknownModelReportedAt: new Date().toISOString(),
      },
    })

    return { reported: true, adminsNotified }
  })
}
