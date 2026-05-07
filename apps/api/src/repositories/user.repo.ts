import { UserRole } from '@cems/types'

// Accept the extended client returned by `withSystemAuth(fn)` (a
// Prisma.TransactionClient) — same pattern as audit-log.repo.ts.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PrismaLike = any

export interface AuthUser {
  id: string
  tenantId: string
  email: string
  name: string
  role: UserRole
  passwordHash: string
  assignedStoreIds: string[]
}

/**
 * Returns the row whose email matches (case-insensitive). MVP assumes email
 * is globally unique even though the schema only enforces (tenantId, email)
 * uniqueness — Story 1.3+ may add a multi-tenant resolver. If two rows
 * happen to share an email across tenants, this returns the FIRST one and
 * the caller must treat the ambiguity as a 401-deny case.
 *
 * The caller MUST pass `tx` from `withSystemAuth(...)` so RLS is satisfied
 * via the OR-ADMIN bypass — see `system-auth-context.ts`.
 *
 * Returns null when no user matches. Once Story 1.3 adds a `status` column,
 * tighten this to also require `status = 'ACTIVE'`.
 */
export async function findActiveUserByEmail(tx: PrismaLike, email: string): Promise<AuthUser | null> {
  return mapRow(await selectUserBy(tx, { email }))
}

export async function findActiveUserById(tx: PrismaLike, id: string): Promise<AuthUser | null> {
  return mapRow(await selectUserBy(tx, { id }))
}

interface UserRow {
  id: string
  tenantId: string
  email: string
  name: string
  role: string
  passwordHash: string
  assignedStoreIds: string
}

async function selectUserBy(tx: PrismaLike, where: { email?: string; id?: string }): Promise<UserRow | null> {
  return tx.user.findFirst({
    where,
    select: {
      id: true,
      tenantId: true,
      email: true,
      name: true,
      role: true,
      passwordHash: true,
      assignedStoreIds: true,
    },
  }) as Promise<UserRow | null>
}

function mapRow(row: UserRow | null): AuthUser | null {
  if (!row) return null
  let assignedStoreIds: string[] = []
  try {
    const parsed: unknown = JSON.parse(row.assignedStoreIds)
    if (Array.isArray(parsed)) {
      assignedStoreIds = parsed.filter((v): v is string => typeof v === 'string' && v.length > 0)
    }
  } catch {
    assignedStoreIds = []
  }
  return {
    id: row.id,
    tenantId: row.tenantId,
    email: row.email,
    name: row.name,
    role: row.role as UserRole,
    passwordHash: row.passwordHash,
    assignedStoreIds,
  }
}
