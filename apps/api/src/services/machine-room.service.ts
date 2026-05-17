import type { FastifyRequest } from 'fastify'
import { AuditStatus, UserRole, type MachineRoom } from '@cems/types'
import { RoleNotPermittedError } from '../lib/auth-errors.js'
import { AuditNotEditableError } from '../lib/audit-errors.js'
import { getAuditOwnership } from '../repositories/audit.repo.js'
import {
  createMachineRoom,
  getMachineRoomById,
  getMachineRoomsByAuditId,
  upsertMachineRoomData,
} from '../repositories/machine-room.repo.js'
import { MachineRoomNotFoundError } from '../lib/audit-errors.js'

export interface ServiceContext {
  request: FastifyRequest
}

/**
 * Returns the first machine room for the given audit, creating one (roomNumber='1')
 * if none exists. AUDITOR-only; caller must own a DRAFT audit.
 * Safe to call on every page load — idempotent POST semantics.
 */
export async function getOrCreateMachineRoom(
  { auditId }: { auditId: string },
  ctx: ServiceContext,
): Promise<MachineRoom> {
  const rls = ctx.request.rlsContext
  if (!rls) throw new Error('getOrCreateMachineRoom requires an authenticated request')
  if (rls.role !== UserRole.AUDITOR) throw new RoleNotPermittedError()

  return ctx.request.withRls(async (tx) => {
    const ownership = await getAuditOwnership(tx, auditId)
    if (!ownership || ownership.auditorUserId !== rls.userId || ownership.status !== AuditStatus.DRAFT) {
      throw new AuditNotEditableError()
    }

    const rooms = await getMachineRoomsByAuditId(tx, { auditId })
    if (rooms.length > 0) return rooms[0]!

    try {
      return await createMachineRoom(tx, { tenantId: rls.tenantId, auditId, roomNumber: '1' })
    } catch (err: unknown) {
      // P2002: concurrent request already created the room — return it (P15).
      if (err != null && typeof err === 'object' && 'code' in err && (err as { code: unknown }).code === 'P2002') {
        const rooms2 = await getMachineRoomsByAuditId(tx, { auditId })
        if (rooms2.length > 0) return rooms2[0]!
      }
      throw err
    }
  })
}

/**
 * List all machine rooms for an audit. Any authenticated role (RLS scopes by tenant).
 */
export async function getMachineRooms(
  { auditId }: { auditId: string },
  ctx: ServiceContext,
): Promise<MachineRoom[]> {
  const rls = ctx.request.rlsContext
  if (!rls) throw new Error('getMachineRooms requires an authenticated request')

  return ctx.request.withRls((tx) => getMachineRoomsByAuditId(tx, { auditId }))
}

/**
 * Patch machine room data. AUDITOR-only; caller must own a DRAFT audit.
 * Atomically updates machine_rooms.data, refreshes the audit_sections
 * refrigeration cursor, and bumps audits.current_section_id.
 */
export async function patchMachineRoom(
  {
    auditId,
    roomId,
    data,
  }: { auditId: string; roomId: string; data: Record<string, unknown> },
  ctx: ServiceContext,
): Promise<{ savedAt: string; roomId: string }> {
  const rls = ctx.request.rlsContext
  if (!rls) throw new Error('patchMachineRoom requires an authenticated request')
  if (rls.role !== UserRole.AUDITOR) throw new RoleNotPermittedError()

  return ctx.request.withRls(async (tx) => {
    const ownership = await getAuditOwnership(tx, auditId)
    if (!ownership || ownership.auditorUserId !== rls.userId || ownership.status !== AuditStatus.DRAFT) {
      throw new AuditNotEditableError()
    }

    // Verify the room belongs to this audit (P2 fix).
    const room = await getMachineRoomById(tx, { id: roomId })
    if (!room || room.auditId !== auditId) throw new MachineRoomNotFoundError()

    return upsertMachineRoomData(tx, { id: roomId, auditId, tenantId: rls.tenantId, data })
  })
}
