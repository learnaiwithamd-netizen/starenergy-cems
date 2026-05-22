import type { CompressorRef } from '@cems/types'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PrismaLike = any

export interface FindCompressorRefInput {
  modelNumber: string
  /** When provided, pin the lookup to a specific compressor_db_version. */
  version?: string
}

/** Defensive parse of the NVarChar(Max) regression_coefficients JSON string. */
function parseCoefficients(raw: string): Record<string, unknown> {
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
  compressorDbVersion: string
  modelNumber: string
  manufacturer: string
  refrigerantType: string
  regressionCoefficients: string
  createdAt: Date
}): CompressorRef {
  return {
    id: row.id,
    compressorDbVersion: row.compressorDbVersion,
    modelNumber: row.modelNumber,
    manufacturer: row.manufacturer,
    refrigerantType: row.refrigerantType,
    regressionCoefficients: parseCoefficients(row.regressionCoefficients),
    createdAt: row.createdAt.toISOString(),
  }
}

/**
 * Look up a compressor model in the GLOBAL `compressor_refs` reference table.
 *
 * `compressor_refs` is NOT tenant-scoped and NOT RLS-protected, so `db` here is
 * the plain Prisma client — NOT an RLS transaction. When `version` is omitted we
 * return the row from the highest `compressor_db_version` (string-desc order is
 * fine for the `'1.0'`-style versions we seed). Returns null when no model matches.
 */
export async function findCompressorRefByModel(
  db: PrismaLike,
  { modelNumber, version }: FindCompressorRefInput,
): Promise<CompressorRef | null> {
  const row = await db.compressorRef.findFirst({
    where: version ? { modelNumber, compressorDbVersion: version } : { modelNumber },
    orderBy: { compressorDbVersion: 'desc' },
  })
  if (!row) return null
  return mapRow(row)
}
