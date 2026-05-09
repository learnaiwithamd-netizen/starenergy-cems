import type { FastifyRequest } from 'fastify'
import { UserRole, type ListStoresQuery, type ListStoresResponse, type StoreDetail } from '@cems/types'
import { listStores, getStoreByStoreNumber } from '../repositories/store.repo.js'
import { getRedisConnection } from '../lib/redis.js'

export interface ServiceContext {
  request: FastifyRequest
}

const STORE_DETAIL_TTL_S = 3_600 // 1 h
const MAPS_TIMEOUT_MS = 5_000

function storeCacheKey(tenantId: string, storeNumber: string): string {
  return `store:detail:${tenantId}:${storeNumber}`
}

/**
 * Lists stores visible to the caller. RLS scopes the tenant; this service
 * additionally honours `assignedToUser` for AUDITOR + CLIENT roles by
 * filtering to `rlsContext.assignedStoreIds`. ADMIN ignores the flag and
 * always sees all stores in the tenant.
 *
 * `query.search` is currently a no-op at the API layer — the SPA filters
 * client-side. The schema accepts it so a future server-side search can
 * opt in without breaking the client. (Story 2.1 Dev Notes.)
 */
export async function listStoresForCaller(
  query: ListStoresQuery,
  ctx: ServiceContext,
): Promise<ListStoresResponse> {
  const rls = ctx.request.rlsContext
  if (!rls) throw new Error('listStoresForCaller requires an authenticated request')

  // ADMIN always sees the whole tenant — assignedToUser is ignored.
  if (rls.role === UserRole.ADMIN || !query.assignedToUser) {
    return ctx.request.withRls((tx) => listStores(tx))
  }

  // AUDITOR + CLIENT honour the flag. Empty assignedStoreIds → empty list
  // (the repo short-circuits before hitting the DB).
  const ids = rls.assignedStoreIds ? [...rls.assignedStoreIds] : []
  return ctx.request.withRls((tx) => listStores(tx, { ids }))
}

/**
 * Returns full store detail for a single store, Redis-cached for 1 h.
 * On cache miss: fetches from DB, then attempts Google Maps address
 * enrichment (best-effort, 5 s timeout). Falls back to stored address
 * if Maps is unavailable or the key is not configured.
 */
export async function getStoreDetail(
  storeNumber: string,
  ctx: ServiceContext,
): Promise<StoreDetail | null> {
  const rls = ctx.request.rlsContext
  if (!rls) throw new Error('getStoreDetail requires an authenticated request')

  const redis = getRedisConnection()
  const cacheKey = storeCacheKey(rls.tenantId, storeNumber)

  const cached = await redis.get(cacheKey)
  if (cached) {
    try {
      return JSON.parse(cached) as StoreDetail
    } catch {
      await redis.del(cacheKey).catch(() => undefined)
    }
  }

  const store = await ctx.request.withRls((tx) => getStoreByStoreNumber(tx, storeNumber))
  if (!store) return null

  const enriched = await enrichAddressWithMaps(store)
  await redis.set(cacheKey, JSON.stringify(enriched), 'EX', STORE_DETAIL_TTL_S).catch(() => undefined)
  return enriched
}

interface MapsGeocodeResponse {
  status: string
  results: Array<{ formatted_address: string }>
}

async function enrichAddressWithMaps(store: StoreDetail): Promise<StoreDetail> {
  const apiKey = process.env['GOOGLE_MAPS_API_KEY']
  if (!apiKey || (!store.postalCode && !store.address)) return store

  try {
    const rawQuery = (store.postalCode ?? store.address ?? '').trim()
    if (!rawQuery) return store
    const query = encodeURIComponent(rawQuery)
    const res = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?address=${query}&key=${apiKey}`,
      { signal: AbortSignal.timeout(MAPS_TIMEOUT_MS) },
    )
    if (!res.ok) return store
    const data = (await res.json()) as MapsGeocodeResponse
    if (data.status !== 'OK' || !data.results[0]) return store
    return { ...store, address: data.results[0].formatted_address }
  } catch {
    return store
  }
}
