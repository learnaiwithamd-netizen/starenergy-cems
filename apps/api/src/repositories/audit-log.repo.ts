// audit-log.repo.ts — APPEND-ONLY repository for the audit_log table.
//
// Architecture mandate: this module MUST NOT export update, delete, or upsert operations.
// The AuditLog table carries the tamper-evident trail for state transitions, LLM overrides,
// and tenant-scoped security events. Any change to its rows is a data-integrity incident.
// DB-level append-only enforcement: the audit_log SECURITY POLICY blocks UPDATE and DELETE
// via the deny-all `fn_audit_log_deny_write` predicate.

import type { PrismaClient } from '@cems/db'
import { UserRole } from '@cems/types'

// Accept the extended client returned by `withRlsContext(prisma, ctx)`. Both the real
// PrismaClient and the extended variant expose `auditLog.create`.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PrismaLike = PrismaClient | any

export interface AppendLogInput {
  tenantId: string
  auditId?: string
  eventType: string
  payload: Record<string, unknown>
  actorUserId?: string
  actorRole?: UserRole
}

export interface AppendLogResult {
  id: string
  occurredAt: Date
}

/**
 * Inserts one immutable row into audit_log.
 *
 * Caller MUST pass an RLS-wrapped Prisma client (from `withRlsContext(prisma, ctx)`).
 * The DB BLOCK predicate on audit_log rejects the INSERT if SESSION_CONTEXT('tenant_id')
 * doesn't match the `tenantId` in the row — the check at this layer is defence-in-depth.
 */
export async function appendLog(db: PrismaLike, input: AppendLogInput): Promise<AppendLogResult> {
  const row = await db.auditLog.create({
    data: {
      tenantId: input.tenantId,
      auditId: input.auditId ?? null,
      eventType: input.eventType,
      payload: JSON.stringify(input.payload),
      actorUserId: input.actorUserId ?? null,
      actorRole: input.actorRole ?? null,
    },
    select: {
      id: true,
      occurredAt: true,
    },
  })
  return { id: row.id, occurredAt: row.occurredAt }
}
