import type { Compressor } from '@cems/types'
import { CompressorNotFoundError } from '../lib/audit-errors.js'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PrismaLike = any

export interface CreateCompressorInput {
  tenantId: string
  rackId: string
  compressorNumber: string
  compressorRefId?: string | null
  data?: Record<string, unknown>
}

export interface UpsertCompressorDataInput {
  id: string
  rackId: string
  tenantId: string
  data: Record<string, unknown>
  /** Present (incl. null) → write the column; absent → leave it untouched. */
  compressorRefId?: string | null
}

export interface DuplicateCompressorInput {
  sourceId: string
  rackId: string
  tenantId: string
  compressorNumber: string
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
  rackId: string
  compressorNumber: string
  compressorRefId: string | null
  data: string
  createdAt: Date
  updatedAt: Date
}): Compressor {
  return {
    id: row.id,
    tenantId: row.tenantId,
    rackId: row.rackId,
    compressorNumber: row.compressorNumber,
    compressorRefId: row.compressorRefId,
    data: parseData(row.data),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

/**
 * Create a compressor under a rack. There is no `[rackId, compressorNumber]`
 * unique constraint (unlike racks), so no P2002 concurrency retry is required.
 */
export async function createCompressor(tx: PrismaLike, input: CreateCompressorInput): Promise<Compressor> {
  const row = await tx.compressor.create({
    data: {
      tenantId: input.tenantId,
      rackId: input.rackId,
      compressorNumber: input.compressorNumber,
      compressorRefId: input.compressorRefId ?? null,
      data: JSON.stringify(input.data ?? {}),
    },
  })
  return mapRow(row)
}

export async function getCompressorsByRackId(
  tx: PrismaLike,
  { rackId }: { rackId: string },
): Promise<Compressor[]> {
  const rows = await tx.compressor.findMany({
    where: { rackId },
    orderBy: { createdAt: 'asc' },
  })
  return rows.map(mapRow)
}

export async function getCompressorById(
  tx: PrismaLike,
  { id }: { id: string },
): Promise<Compressor | null> {
  const row = await tx.compressor.findUnique({ where: { id } })
  if (!row) return null
  return mapRow(row)
}

/**
 * Write compressor data. The WHERE folds in `rackId` so a compressor scoped to a
 * different rack cannot be written cross-rack (same P2 guard as the rack repo);
 * a missed predicate surfaces as Prisma P2025 → `CompressorNotFoundError`. The
 * `compressorRefId` column is only touched when the key is present in `input`.
 */
export async function upsertCompressorData(
  tx: PrismaLike,
  input: UpsertCompressorDataInput,
): Promise<{ savedAt: string; compressorId: string }> {
  const updateData: Record<string, unknown> = { data: JSON.stringify(input.data) }
  if ('compressorRefId' in input) {
    updateData['compressorRefId'] = input.compressorRefId ?? null
  }

  let updated: { updatedAt: Date }
  try {
    updated = await tx.compressor.update({
      where: { id: input.id, rackId: input.rackId },
      data: updateData,
      select: { updatedAt: true },
    })
  } catch (err: unknown) {
    if (
      err != null &&
      typeof err === 'object' &&
      'code' in err &&
      (err as { code: unknown }).code === 'P2025'
    ) {
      throw new CompressorNotFoundError()
    }
    throw err
  }
  return { savedAt: updated.updatedAt.toISOString(), compressorId: input.id }
}

/**
 * Duplicate a compressor: copy its `data` and `compressorRefId`, but clear the
 * unique `data.general.serialNumber` (model / refrigerant / EER / capacity are
 * intentionally retained — FR7).
 */
export async function duplicateCompressor(
  tx: PrismaLike,
  input: DuplicateCompressorInput,
): Promise<Compressor> {
  const source = await tx.compressor.findUnique({ where: { id: input.sourceId } })
  if (!source || source.rackId !== input.rackId) {
    throw new CompressorNotFoundError()
  }

  const sourceData = parseData(source.data as string)
  const sourceGeneral = sourceData['general'] as Record<string, unknown> | undefined
  const newData: Record<string, unknown> = { ...sourceData }
  if (sourceGeneral) {
    const { serialNumber: _omit, ...rest } = sourceGeneral
    void _omit
    newData['general'] = rest
  }

  return createCompressor(tx, {
    tenantId: input.tenantId,
    rackId: input.rackId,
    compressorNumber: input.compressorNumber,
    compressorRefId: source.compressorRefId ?? null,
    data: newData,
  })
}
