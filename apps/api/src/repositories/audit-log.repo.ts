// audit-log.repo.ts — APPEND-ONLY repository for the audit_log table.
//
// Architecture mandate: this module MUST NOT export update, delete, or upsert operations.
// The AuditLog table carries the tamper-evident trail for state transitions, LLM overrides,
// and tenant-scoped security events. Any change to its rows is a data-integrity incident.

import { prisma } from '@cems/db'
import { UserRole } from '@cems/types'

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
 * Inserts one immutable row into audit_log. Callers MUST have set the tenant_id
 * SESSION_CONTEXT before invoking (via `withRlsContext`); the DB BLOCK predicate
 * on audit_log enforces cross-tenant write safety.
 */
export async function appendLog(input: AppendLogInput): Promise<AppendLogResult> {
  const row = await prisma.auditLog.create({
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
