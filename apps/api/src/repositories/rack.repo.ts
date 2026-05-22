import type { Rack } from '@cems/types'
import { RackNotFoundError } from '../lib/audit-errors.js'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PrismaLike = any

export interface CreateRackInput {
  tenantId: string
  machineRoomId: string
  rackNumber: string
  data?: Record<string, unknown>
}

export interface UpsertRackDataInput {
  id: string
  machineRoomId: string
  tenantId: string
  data: Record<string, unknown>
}

export interface DuplicateRackInput {
  sourceId: string
  machineRoomId: string
  tenantId: string
  rackNumber: string
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
  machineRoomId: string
  rackNumber: string
  data: string
  createdAt: Date
  updatedAt: Date
}): Rack {
  return {
    id: row.id,
    tenantId: row.tenantId,
    machineRoomId: row.machineRoomId,
    rackNumber: row.rackNumber,
    data: parseData(row.data),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

/**
 * Create a new rack row under a machine room. The
 * `@@unique([machineRoomId, rackNumber])` constraint surfaces a concurrent
 * create as Prisma P2002 — the service layer re-derives + retries once.
 */
export async function createRack(tx: PrismaLike, input: CreateRackInput): Promise<Rack> {
  const row = await tx.rack.create({
    data: {
      tenantId: input.tenantId,
      machineRoomId: input.machineRoomId,
      rackNumber: input.rackNumber,
      data: JSON.stringify(input.data ?? {}),
    },
  })
  return mapRow(row)
}

export async function getRacksByMachineRoomId(
  tx: PrismaLike,
  { machineRoomId }: { machineRoomId: string },
): Promise<Rack[]> {
  const rows = await tx.rack.findMany({
    where: { machineRoomId },
    orderBy: { createdAt: 'asc' },
  })
  return rows.map(mapRow)
}

export async function getRackById(
  tx: PrismaLike,
  { id }: { id: string },
): Promise<Rack | null> {
  const row = await tx.rack.findUnique({ where: { id } })
  if (!row) return null
  return mapRow(row)
}

/**
 * Write rack data. The WHERE clause includes `machineRoomId` so a rack id
 * scoped to a different machine room cannot be written cross-room (same P2
 * guard pattern as `upsertMachineRoomData`). Prisma surfaces a missed
 * predicate as P2025 → `RackNotFoundError`.
 *
 * The incoming `data` carries only the sub-key(s) the caller edited (e.g.
 * `{ general }`). We read the existing blob and SHALLOW-MERGE at the top level
 * so a save never clobbers other sub-keys (e.g. a future `pipeHeaders` from
 * Story 3.3). Each sub-object is sent whole, so a top-level merge is correct.
 */
export async function upsertRackData(
  tx: PrismaLike,
  input: UpsertRackDataInput,
): Promise<{ savedAt: string; rackId: string }> {
  const existing = await tx.rack.findFirst({
    where: { id: input.id, machineRoomId: input.machineRoomId },
    select: { data: true },
  })
  if (!existing) throw new RackNotFoundError()
  const mergedData = { ...parseData(existing.data as string), ...input.data }

  let updated: { updatedAt: Date }
  try {
    updated = await tx.rack.update({
      where: { id: input.id, machineRoomId: input.machineRoomId },
      data: { data: JSON.stringify(mergedData) },
      select: { updatedAt: true },
    })
  } catch (err: unknown) {
    if (
      err != null &&
      typeof err === 'object' &&
      'code' in err &&
      (err as { code: unknown }).code === 'P2025'
    ) {
      throw new RackNotFoundError()
    }
    throw err
  }
  return { savedAt: updated.updatedAt.toISOString(), rackId: input.id }
}

/**
 * Duplicate an existing rack: copy its `data` blob but clear the required
 * `data.general.rackDesignation` so the Auditor must pick a new unique name.
 */
export async function duplicateRack(tx: PrismaLike, input: DuplicateRackInput): Promise<Rack> {
  const source = await tx.rack.findUnique({ where: { id: input.sourceId } })
  if (!source || source.machineRoomId !== input.machineRoomId) {
    throw new RackNotFoundError()
  }

  const sourceData = parseData(source.data as string)
  const sourceGeneral = sourceData['general'] as Record<string, unknown> | undefined
  const newData: Record<string, unknown> = { ...sourceData }
  if (sourceGeneral) {
    const { rackDesignation: _omit, ...rest } = sourceGeneral
    void _omit
    newData['general'] = rest
  }

  return createRack(tx, {
    tenantId: input.tenantId,
    machineRoomId: input.machineRoomId,
    rackNumber: input.rackNumber,
    data: newData,
  })
}
