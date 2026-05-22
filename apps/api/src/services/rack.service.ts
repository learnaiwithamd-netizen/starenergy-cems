import type { FastifyRequest } from 'fastify'
import { AuditStatus, UserRole, type Rack } from '@cems/types'
import { RoleNotPermittedError } from '../lib/auth-errors.js'
import { AuditNotEditableError, MachineRoomNotFoundError, RackNotFoundError } from '../lib/audit-errors.js'
import { getAuditOwnership } from '../repositories/audit.repo.js'
import { getMachineRoomById } from '../repositories/machine-room.repo.js'
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Tx = any

/** True when the error is a Prisma P2002 unique-constraint violation. */
function isPrismaP2002(err: unknown): boolean {
  return (
    err != null &&
    typeof err === 'object' &&
    'code' in err &&
    (err as { code: unknown }).code === 'P2002'
  )
}

/** Throw AuditNotEditableError unless the audit exists, is owned by the caller, and is DRAFT. */
async function assertEditable(tx: Tx, auditId: string, userId: string): Promise<void> {
  const ownership = await getAuditOwnership(tx, auditId)
  if (!ownership || ownership.auditorUserId !== userId || ownership.status !== AuditStatus.DRAFT) {
    throw new AuditNotEditableError()
  }
}

/** Throw MachineRoomNotFoundError unless `machineRoomId` actually belongs to `auditId`. */
async function assertRoomBelongsToAudit(tx: Tx, machineRoomId: string, auditId: string): Promise<void> {
  const room = await getMachineRoomById(tx, { id: machineRoomId })
  if (!room || room.auditId !== auditId) throw new MachineRoomNotFoundError()
}

/**
 * Create a new rack under a machine room. AUDITOR-only; caller must own a
 * DRAFT audit and the room must belong to that audit. `rackNumber` is derived
 * as (existing rack count + 1). A concurrent create surfaces as Prisma P2002;
 * because that error dooms the open transaction, we retry once in a FRESH
 * transaction (re-deriving the next number).
 */
export async function createRack(
  { machineRoomId, auditId }: { machineRoomId: string; auditId: string },
  ctx: ServiceContext,
): Promise<Rack> {
  const rls = ctx.request.rlsContext
  if (!rls) throw new Error('createRack requires an authenticated request')
  if (rls.role !== UserRole.AUDITOR) throw new RoleNotPermittedError()

  const attempt = async (tx: Tx): Promise<Rack> => {
    await assertEditable(tx, auditId, rls.userId)
    await assertRoomBelongsToAudit(tx, machineRoomId, auditId)
    const racks = await getRacksByMachineRoomId(tx, { machineRoomId })
    return createRackRepo(tx, {
      tenantId: rls.tenantId,
      machineRoomId,
      rackNumber: String(racks.length + 1),
    })
  }

  try {
    return await ctx.request.withRls(attempt)
  } catch (err: unknown) {
    if (!isPrismaP2002(err)) throw err
    // Concurrent create grabbed our number and doomed the tx — retry once fresh.
    return ctx.request.withRls(attempt)
  }
}

/** List all racks for a machine room. Any authenticated role; room must belong to the audit. */
export async function getRacks(
  { machineRoomId, auditId }: { machineRoomId: string; auditId: string },
  ctx: ServiceContext,
): Promise<Rack[]> {
  const rls = ctx.request.rlsContext
  if (!rls) throw new Error('getRacks requires an authenticated request')

  return ctx.request.withRls(async (tx: Tx) => {
    await assertRoomBelongsToAudit(tx, machineRoomId, auditId)
    return getRacksByMachineRoomId(tx, { machineRoomId })
  })
}

/** Fetch a single rack. Any authenticated role; throws RackNotFoundError if missing. */
export async function getRackById(
  { rackId, machineRoomId, auditId }: { rackId: string; machineRoomId: string; auditId: string },
  ctx: ServiceContext,
): Promise<Rack> {
  const rls = ctx.request.rlsContext
  if (!rls) throw new Error('getRackById requires an authenticated request')

  return ctx.request.withRls(async (tx: Tx) => {
    await assertRoomBelongsToAudit(tx, machineRoomId, auditId)
    const rack = await getRackByIdRepo(tx, { id: rackId })
    if (!rack || rack.machineRoomId !== machineRoomId) throw new RackNotFoundError()
    return rack
  })
}

/**
 * Patch rack data. AUDITOR-only; caller must own a DRAFT audit and the room
 * must belong to that audit. The repo's WHERE clause additionally enforces the
 * rack belongs to the given machine room.
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

  return ctx.request.withRls(async (tx: Tx) => {
    await assertEditable(tx, auditId, rls.userId)
    await assertRoomBelongsToAudit(tx, machineRoomId, auditId)
    return upsertRackData(tx, { id: rackId, machineRoomId, tenantId: rls.tenantId, data })
  })
}

/**
 * Duplicate a rack. AUDITOR-only; caller must own a DRAFT audit and the room
 * must belong to that audit. The new rack copies all source fields except
 * `data.general.rackDesignation`. P2002 retries once in a fresh transaction.
 */
export async function duplicateRack(
  { rackId, machineRoomId, auditId }: { rackId: string; machineRoomId: string; auditId: string },
  ctx: ServiceContext,
): Promise<Rack> {
  const rls = ctx.request.rlsContext
  if (!rls) throw new Error('duplicateRack requires an authenticated request')
  if (rls.role !== UserRole.AUDITOR) throw new RoleNotPermittedError()

  const attempt = async (tx: Tx): Promise<Rack> => {
    await assertEditable(tx, auditId, rls.userId)
    await assertRoomBelongsToAudit(tx, machineRoomId, auditId)
    const racks = await getRacksByMachineRoomId(tx, { machineRoomId })
    return duplicateRackRepo(tx, {
      sourceId: rackId,
      machineRoomId,
      tenantId: rls.tenantId,
      rackNumber: String(racks.length + 1),
    })
  }

  try {
    return await ctx.request.withRls(attempt)
  } catch (err: unknown) {
    if (!isPrismaP2002(err)) throw err
    return ctx.request.withRls(attempt)
  }
}
