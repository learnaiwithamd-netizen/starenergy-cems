import type { AuditListItem } from '@cems/types'
import { AuditStatus } from '@cems/types'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PrismaLike = any

export interface ListAuditsResult {
  audits: AuditListItem[]
  total: number
}

interface AuditRow {
  id: string
  storeId: string | null
  status: string
  createdAt: Date
  updatedAt: Date
}

/**
 * RLS-scoped audit list. Caller passes the tx from `request.withRls(...)`
 * so Azure SQL's `security.fn_audits_filter` enforces both tenant scoping
 * AND CLIENT-role store-scoping (audits where store_id ∈
 * SESSION_CONTEXT('assigned_store_ids')) at the DB layer.
 *
 * This is the Story 1.4 STUB — minimum needed to validate AC2. Epic 2
 * + Story 7.1 replace this with the full feature endpoint (filtering,
 * pagination, sorting, calc fields). Forward-compatible response shape.
 */
export async function listAuditsForCaller(
  tx: PrismaLike,
  opts: { take?: number } = {},
): Promise<ListAuditsResult> {
  const take = opts.take ?? 50
  const rows: AuditRow[] = await tx.audit.findMany({
    select: {
      id: true,
      storeId: true,
      status: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: { createdAt: 'desc' },
    take,
  })
  const audits = rows.map<AuditListItem>((row) => ({
    id: row.id,
    storeId: row.storeId,
    status: row.status as AuditStatus,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }))
  return { audits, total: audits.length }
}
