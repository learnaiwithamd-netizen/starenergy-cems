import type { MachineRoom } from '@cems/types'
import { MachineRoomNotFoundError } from '../lib/audit-errors.js'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PrismaLike = any

export interface CreateMachineRoomInput {
  tenantId: string
  auditId: string
  roomNumber: string
}

export interface UpsertMachineRoomDataInput {
  id: string
  auditId: string
  tenantId: string
  data: Record<string, unknown>
}

function parseData(raw: string): Record<string, unknown> {
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

function mapRow(row: {
  id: string
  tenantId: string
  auditId: string
  roomNumber: string
  data: string
  createdAt: Date
  updatedAt: Date
}): MachineRoom {
  return {
    id: row.id,
    tenantId: row.tenantId,
    auditId: row.auditId,
    roomNumber: row.roomNumber,
    data: parseData(row.data),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

/**
 * Create a new machine room row, then atomically:
 * (1) Upsert audit_sections row for 'refrigeration' so SectionOverviewPage can
 *     derive the section's existence.
 * (2) Set audits.current_section_id = 'refrigeration'.
 */
export async function createMachineRoom(
  tx: PrismaLike,
  input: CreateMachineRoomInput,
): Promise<MachineRoom> {
  const row = await tx.machineRoom.create({
    data: {
      tenantId: input.tenantId,
      auditId: input.auditId,
      roomNumber: input.roomNumber,
      data: '{}',
    },
  })

  await tx.auditSection.upsert({
    where: { auditId_sectionId: { auditId: input.auditId, sectionId: 'refrigeration' } },
    create: { tenantId: input.tenantId, auditId: input.auditId, sectionId: 'refrigeration', data: '{}' },
    update: {},
  })

  await tx.audit.update({
    where: { id: input.auditId },
    data: { currentSectionId: 'refrigeration' },
  })

  return mapRow(row)
}

export async function getMachineRoomsByAuditId(
  tx: PrismaLike,
  { auditId }: { auditId: string },
): Promise<MachineRoom[]> {
  const rows = await tx.machineRoom.findMany({ where: { auditId }, orderBy: { createdAt: 'asc' } })
  return rows.map(mapRow)
}

export async function getMachineRoomById(
  tx: PrismaLike,
  { id }: { id: string },
): Promise<MachineRoom | null> {
  const row = await tx.machineRoom.findUnique({ where: { id } })
  if (!row) return null
  return mapRow(row)
}

/**
 * Write machine room data and keep the refrigeration section cursor in sync.
 * Four writes happen inside the same RLS transaction (atomicity guaranteed by
 * withRls wrapping these calls in a single Prisma interactive transaction).
 */
export async function upsertMachineRoomData(
  tx: PrismaLike,
  input: UpsertMachineRoomDataInput,
): Promise<{ savedAt: string; roomId: string }> {
  let updated: { updatedAt: Date }
  try {
    updated = await tx.machineRoom.update({
      where: { id: input.id, auditId: input.auditId },
      data: { data: JSON.stringify(input.data) },
      select: { updatedAt: true },
    })
  } catch (err: unknown) {
    if (
      err != null &&
      typeof err === 'object' &&
      'code' in err &&
      (err as { code: unknown }).code === 'P2025'
    ) {
      throw new MachineRoomNotFoundError()
    }
    throw err
  }

  // Fetch existing section data, merge machineRoomIds, then write back (D1 fix).
  const existingSection = await tx.auditSection.findFirst({
    where: { auditId: input.auditId, sectionId: 'refrigeration' },
    select: { data: true },
  })
  const existingData = parseData(existingSection?.data ?? '{}')
  const existingIds = Array.isArray(existingData['machineRoomIds'])
    ? (existingData['machineRoomIds'] as string[])
    : []
  const machineRoomIds = existingIds.includes(input.id) ? existingIds : [...existingIds, input.id]
  const summary = { machineRoomIds, lastSavedAt: updated.updatedAt.toISOString() }

  await tx.auditSection.upsert({
    where: { auditId_sectionId: { auditId: input.auditId, sectionId: 'refrigeration' } },
    create: {
      tenantId: input.tenantId,
      auditId: input.auditId,
      sectionId: 'refrigeration',
      data: JSON.stringify(summary),
    },
    update: { data: JSON.stringify(summary) },
  })

  await tx.audit.update({
    where: { id: input.auditId },
    data: { currentSectionId: 'refrigeration' },
  })

  return { savedAt: updated.updatedAt.toISOString(), roomId: input.id }
}

