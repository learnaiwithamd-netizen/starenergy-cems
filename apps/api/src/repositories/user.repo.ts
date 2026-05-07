import { UserRole, type AdminUser, type UserStatus } from '@cems/types'

// Accept the extended client returned by `withSystemAuth(fn)` or
// `request.withRls(...)` — same pattern as audit-log.repo.ts.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PrismaLike = any

export interface AuthUser {
  id: string
  tenantId: string
  email: string
  name: string
  role: UserRole
  status: UserStatus
  passwordHash: string
  assignedStoreIds: string[]
}

/**
 * Returns the row whose email matches. MVP assumes email is globally unique
 * even though the schema enforces uniqueness only on (tenantId, email).
 * If two rows ever share an email across tenants, this returns the FIRST
 * one and the caller treats the ambiguity as a 401-deny.
 *
 * Caller MUST pass `tx` from `withSystemAuth(...)` so RLS is satisfied via
 * the OR-ADMIN bypass — see `system-auth-context.ts`.
 *
 * Returns null when no user matches. Status is INCLUDED in the result so
 * the auth service can reject INACTIVE users (Story 1.3 AC3).
 */
export async function findActiveUserByEmail(tx: PrismaLike, email: string): Promise<AuthUser | null> {
  return mapRow(await selectUserBy(tx, { email }))
}

export async function findActiveUserById(tx: PrismaLike, id: string): Promise<AuthUser | null> {
  return mapRow(await selectUserBy(tx, { id }))
}

/**
 * RLS-scoped lookup — returns null if the user is in another tenant. Used
 * by the admin user-management routes (Story 1.3 AC2/AC3) where the caller
 * passes `request.withRls(...)` (rather than the system-auth bypass).
 */
export async function findUserByIdInTenant(tx: PrismaLike, id: string): Promise<AuthUser | null> {
  return mapRow(await selectUserBy(tx, { id }))
}

// ─── Admin user-management (Story 1.3) ──────────────────────────────────

export interface CreateUserInput {
  tenantId: string
  email: string
  name: string
  role: UserRole
  passwordHash: string
  status?: UserStatus
  assignedStoreIds?: string[]
}

export async function createUser(tx: PrismaLike, input: CreateUserInput): Promise<AdminUser> {
  const row = await tx.user.create({
    data: {
      tenantId: input.tenantId,
      email: input.email,
      name: input.name,
      role: input.role,
      status: input.status ?? 'ACTIVE',
      passwordHash: input.passwordHash,
      assignedStoreIds: JSON.stringify(input.assignedStoreIds ?? []),
    },
    select: adminUserSelect,
  })
  return toAdminUser(row)
}

export interface UpdateUserPatch {
  email?: string
  name?: string
  status?: UserStatus
  assignedStoreIds?: string[]
}

export async function updateUser(
  tx: PrismaLike,
  id: string,
  patch: UpdateUserPatch,
): Promise<AdminUser | null> {
  // Translate the partial patch into Prisma's data shape. assignedStoreIds
  // is stored as a JSON-encoded string in NVARCHAR(MAX); only stringify
  // when present.
  const data: Record<string, unknown> = {}
  if (patch.email !== undefined) data['email'] = patch.email
  if (patch.name !== undefined) data['name'] = patch.name
  if (patch.status !== undefined) data['status'] = patch.status
  if (patch.assignedStoreIds !== undefined) {
    data['assignedStoreIds'] = JSON.stringify(patch.assignedStoreIds)
  }

  try {
    const row = await tx.user.update({
      where: { id },
      data,
      select: adminUserSelect,
    })
    return toAdminUser(row)
  } catch (err) {
    // P2025 = "An operation failed because it depends on one or more records that were required but not found."
    if ((err as { code?: string }).code === 'P2025') return null
    throw err
  }
}

export interface ListUsersInput {
  role: UserRole
  status?: UserStatus
  limit?: number
}

export interface ListUsersResult {
  users: AdminUser[]
  total: number
}

export async function listUsersByRole(
  tx: PrismaLike,
  input: ListUsersInput,
): Promise<ListUsersResult> {
  const limit = input.limit ?? 200
  const where: Record<string, unknown> = { role: input.role }
  if (input.status) where['status'] = input.status
  const rows: AdminUserRow[] = await tx.user.findMany({
    where,
    select: adminUserSelect,
    orderBy: { createdAt: 'desc' },
    take: limit,
  })
  return {
    users: rows.map(toAdminUser),
    total: rows.length,
  }
}

// ─── internals ─────────────────────────────────────────────────────────

interface UserRow {
  id: string
  tenantId: string
  email: string
  name: string
  role: string
  status: string
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
      status: true,
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
    status: row.status as UserStatus,
    passwordHash: row.passwordHash,
    assignedStoreIds,
  }
}

const adminUserSelect = {
  id: true,
  tenantId: true,
  email: true,
  name: true,
  role: true,
  status: true,
  assignedStoreIds: true,
  createdAt: true,
  updatedAt: true,
} as const

interface AdminUserRow {
  id: string
  tenantId: string
  email: string
  name: string
  role: string
  status: string
  assignedStoreIds: string
  createdAt: Date
  updatedAt: Date
}

function toAdminUser(row: AdminUserRow): AdminUser {
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
    status: row.status as UserStatus,
    assignedStoreIds,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}
