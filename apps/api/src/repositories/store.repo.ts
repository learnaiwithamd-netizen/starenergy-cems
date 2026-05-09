import type { StoreSummary, StoreDetail } from '@cems/types'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PrismaLike = any

export interface ListStoresInput {
  /** When undefined → no id filter. When [] → return [] without a DB call.
   *  When [a, b, …] → `where: { id: { in } }`. */
  ids?: string[]
  take?: number
}

export interface ListStoresResult {
  stores: StoreSummary[]
  total: number
}

interface StoreRow {
  id: string
  storeNumber: string
  storeName: string | null
  banner: string | null
  region: string | null
}

interface StoreDetailRow {
  id: string
  storeNumber: string
  storeName: string | null
  address: string | null
  banner: string | null
  region: string | null
  postalCode: string | null
  operatingHours: string | null
  serviceProviders: string | null
  storeManager: string | null
}

/**
 * RLS-scoped store list. Caller passes the tx from `request.withRls(...)`
 * so Azure SQL filters by tenant via `fn_tenant_predicate`. Empty `ids`
 * short-circuits — admin or auditor with no assigned stores returns []
 * without bothering the DB.
 */
export async function listStores(
  tx: PrismaLike,
  input: ListStoresInput = {},
): Promise<ListStoresResult> {
  if (input.ids !== undefined && input.ids.length === 0) {
    return { stores: [], total: 0 }
  }
  const take = input.take ?? 200
  const where: Record<string, unknown> = {}
  if (input.ids !== undefined) where['id'] = { in: input.ids }
  const rows: StoreRow[] = await tx.storeRef.findMany({
    where,
    select: { id: true, storeNumber: true, storeName: true, banner: true, region: true },
    orderBy: { storeNumber: 'asc' },
    take,
  })
  return {
    stores: rows.map((r) => ({
      id: r.id,
      storeNumber: r.storeNumber,
      storeName: r.storeName,
      banner: r.banner,
      region: r.region,
    })),
    total: rows.length,
  }
}

/**
 * Fetches full store detail by storeNumber within the RLS-scoped tenant.
 * Returns null when no matching store exists in the tenant.
 * `serviceProviders` is stored as a JSON string array — parsed on read.
 */
export async function getStoreByStoreNumber(
  tx: PrismaLike,
  storeNumber: string,
): Promise<StoreDetail | null> {
  const row: StoreDetailRow | null = await tx.storeRef.findFirst({
    where: { storeNumber },
    select: {
      id: true,
      storeNumber: true,
      storeName: true,
      address: true,
      banner: true,
      region: true,
      postalCode: true,
      operatingHours: true,
      serviceProviders: true,
      storeManager: true,
    },
  })
  if (!row) return null
  return {
    id: row.id,
    storeNumber: row.storeNumber,
    storeName: row.storeName,
    address: row.address,
    banner: row.banner,
    region: row.region,
    postalCode: row.postalCode,
    operatingHours: row.operatingHours,
    serviceProviders: parseServiceProviders(row.serviceProviders),
    storeManager: row.storeManager,
  }
}

function parseServiceProviders(raw: string | null): string[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw) as unknown
    return Array.isArray(parsed) ? (parsed as string[]) : []
  } catch {
    return []
  }
}
