import type { FastifyRequest } from 'fastify'
import { AuditStatus, UserRole, type Rack } from '@cems/types'
import { RoleNotPermittedError } from '../lib/auth-errors.js'
import { AuditNotEditableError, RackNotFoundError } from '../lib/audit-errors.js'
import { getAuditOwnership } from '../repositories/audit.repo.js'
import {
  createRack as createRackRepo,
  duplicateRack as duplicateRackRepo,
  getRackById as getRackByIdRepo,
  getRacksByMachineRoomId,
  upsertRackData,
} from '../repositories/rack.repo.js'

export interface ServiceContext {
  request: FastifyRequest
}

/** True when the error is a Prisma P2002 unique-constraint violation. */
function isPrismaP2002(err: unknown): boolean {
  return (
    err != null &&
    typeof err === 'object' &&
    'code' in err &&
    (err as { code: unknown }).code === 'P2002'
  )
}

/**
 * Create a new rack under a machine room. AUDITOR-only; caller must own a
 * DRAFT audit. `rackNumber` is derived as (existing rack count + 1). A
 * concurrent create surfaces as Prisma P2002 — we re-derive and retry once.
 */
export async function createRack(
  { machineRoomId, auditId }: { machineRoomId: string; auditId: string },
  ctx: ServiceContext,
): Promise<Rack> {
  const rls = ctx.request.rlsContext
  if (!rls) throw new Error('createRack requires an authenticated request')
  if (rls.role !== UserRole.AUDITOR) throw new RoleNotPermittedError()

  return ctx.request.withRls(async (tx) => {
    const ownership = await getAuditOwnership(tx, auditId)
    if (!ownership || ownership.auditorUserId !== rls.userId || ownership.status !== AuditStatus.DRAFT) {
      throw new AuditNotEditableError()
    }

    const racks = await getRacksByMachineRoomId(tx, { machineRoomId })
    try {
      return await createRackRepo(tx, {
        tenantId: rls.tenantId,
        machineRoomId,
        rackNumber: String(racks.length + 1),
      })
    } catch (err: unknown) {
      if (isPrismaP2002(err)) {
        // Concurrent create grabbed our number — re-count and retry once.
        const racks2 = await getRacksByMachineRoomId(tx, { machineRoomId })
        return await createRackRepo(tx, {
          tenantId: rls.tenantId,
          machineRoomId,
          rackNumber: String(racks2.length + 1),
        })
      }
      throw err
    }
  })
}

/** List all racks for a machine room. Any authenticated role (RLS scopes by tenant). */
export async function getRacks(
  { machineRoomId }: { machineRoomId: string; auditId: string },
  ctx: ServiceContext,
): Promise<Rack[]> {
  const rls = ctx.request.rlsContext
  if (!rls) throw new Error('getRacks requires an authenticated request')

  return ctx.request.withRls((tx) => getRacksByMachineRoomId(tx, { machineRoomId }))
}

/** Fetch a single rack. Any authenticated role; throws RackNotFoundError if missing. */
export async function getRackById(
  { rackId, machineRoomId }: { rackId: string; machineRoomId: string; auditId: string },
  ctx: ServiceContext,
): Promise<Rack> {
  const rls = ctx.request.rlsContext
  if (!rls) throw new Error('getRackById requires an authenticated request')

  return ctx.request.withRls(async (tx) => {
    const rack = await getRackByIdRepo(tx, { id: rackId })
    if (!rack || rack.machineRoomId !== machineRoomId) throw new RackNotFoundError()
    return rack
  })
}

/**
 * Patch rack data. AUDITOR-only; caller must own a DRAFT audit. The repo's
 * WHERE clause enforces the rack belongs to the given machine room.
 */
export async function patchRack(
  {
    rackId,
    machineRoomId,
    auditId,
    data,
  }: { rackId: string; machineRoomId: string; auditId: string; data: Record<string, unknown> },
  ctx: ServiceContext,
): Promise<{ savedAt: string; rackId: string }> {
  const rls = ctx.request.rlsContext
  if (!rls) throw new Error('patchRack requires an authenticated request')
  if (rls.role !== UserRole.AUDITOR) throw new RoleNotPermittedError()

  return ctx.request.withRls(async (tx) => {
    const ownership = await getAuditOwnership(tx, auditId)
    if (!ownership || ownership.auditorUserId !== rls.userId || ownership.status !== AuditStatus.DRAFT) {
      throw new AuditNotEditableError()
    }

    return upsertRackData(tx, { id: rackId, machineRoomId, tenantId: rls.tenantId, data })
  })
}

/**
 * Duplicate a rack. AUDITOR-only; caller must own a DRAFT audit. The new
 * rack copies all source fields except `data.general.rackDesignation`.
 */
export async function duplicateRack(
  { rackId, machineRoomId, auditId }: { rackId: string; machineRoomId: string; auditId: string },
  ctx: ServiceContext,
): Promise<Rack> {
  const rls = ctx.request.rlsContext
  if (!rls) throw new Error('duplicateRack requires an authenticated request')
  if (rls.role !== UserRole.AUDITOR) throw new RoleNotPermittedError()

  return ctx.request.withRls(async (tx) => {
    const ownership = await getAuditOwnership(tx, auditId)
    if (!ownership || ownership.auditorUserId !== rls.userId || ownership.status !== AuditStatus.DRAFT) {
      throw new AuditNotEditableError()
    }

    const racks = await getRacksByMachineRoomId(tx, { machineRoomId })
    try {
      return await duplicateRackRepo(tx, {
        sourceId: rackId,
        machineRoomId,
        tenantId: rls.tenantId,
        rackNumber: String(racks.length + 1),
      })
    } catch (err: unknown) {
      if (isPrismaP2002(err)) {
        const racks2 = await getRacksByMachineRoomId(tx, { machineRoomId })
        return await duplicateRackRepo(tx, {
          sourceId: rackId,
          machineRoomId,
          tenantId: rls.tenantId,
          rackNumber: String(racks2.length + 1),
        })
      }
      throw err
    }
  })
}
