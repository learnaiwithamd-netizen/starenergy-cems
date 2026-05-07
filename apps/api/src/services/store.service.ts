import type { FastifyRequest } from 'fastify'
import { UserRole, type ListStoresQuery, type ListStoresResponse } from '@cems/types'
import { listStores } from '../repositories/store.repo.js'

export interface ServiceContext {
  request: FastifyRequest
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
