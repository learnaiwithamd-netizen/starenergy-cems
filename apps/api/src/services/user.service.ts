import { randomBytes } from 'node:crypto'
import type { FastifyRequest } from 'fastify'
import {
  UserRole,
  type AdminUser,
  type CreateUserRequest,
  type UpdateUserRequest,
  type ListUsersResponse,
  type UserStatus,
} from '@cems/types'
import { hashPassword } from '../lib/passwords.js'
import { sha256Hex } from '../lib/tokens.js'
import { getAuditAppUrl } from '../lib/url.js'
import { UserEmailConflictError } from '../lib/auth-errors.js'
import {
  createUser as repoCreateUser,
  updateUser as repoUpdateUser,
  listUsersByRole as repoListUsersByRole,
  findUserByIdInTenant,
} from '../repositories/user.repo.js'
import { createPasswordSetToken } from '../repositories/password-set-token.repo.js'
import { deleteSessionsByUserId } from '../repositories/user-session.repo.js'
import { appendLog } from '../repositories/audit-log.repo.js'
import { getEmailNotificationQueue } from '../jobs/queue.js'

/**
 * 24-hour window for the auditor to click the welcome-email link and set
 * an initial password. Long enough to survive a weekend; short enough to
 * keep stale tokens from accumulating.
 */
const PASSWORD_SET_TOKEN_TTL_MS = 24 * 60 * 60 * 1000
const PASSWORD_SET_TOKEN_BYTES = 64

export interface ServiceContext {
  request: FastifyRequest
}

// ─── createAuditor ─────────────────────────────────────────────────────

export async function createAuditor(
  body: CreateUserRequest,
  ctx: ServiceContext,
): Promise<AdminUser> {
  const rls = ctx.request.rlsContext
  if (!rls) throw new Error('createAuditor requires an authenticated request')

  // Generate a strong random initial password the user can never know.
  // Their only path to authentication is the welcome-email link.
  const placeholderPlaintext = randomBytes(32).toString('base64url')
  const passwordHash = await hashPassword(placeholderPlaintext)

  // Welcome-email token: 64-byte random secret, sha256 hex stored.
  const tokenPlain = randomBytes(PASSWORD_SET_TOKEN_BYTES).toString('base64url')
  const tokenHash = sha256Hex(tokenPlain)
  const expiresAt = new Date(Date.now() + PASSWORD_SET_TOKEN_TTL_MS)

  const user = await ctx.request.withRls(async (tx) => {
    let created: AdminUser
    try {
      created = await repoCreateUser(tx, {
        tenantId: rls.tenantId,
        email: body.email,
        name: body.name,
        role: body.role,
        passwordHash,
      })
    } catch (err) {
      if ((err as { code?: string }).code === 'P2002') {
        throw new UserEmailConflictError()
      }
      throw err
    }
    await createPasswordSetToken(tx, {
      tenantId: rls.tenantId,
      userId: created.id,
      tokenHash,
      expiresAt,
    })
    await appendLog(tx, {
      tenantId: rls.tenantId,
      eventType: 'USER_CREATED',
      payload: { targetUserId: created.id, role: created.role, email: created.email },
      actorUserId: rls.userId,
      actorRole: rls.role,
    })
    return created
  })

  // Enqueue welcome email — Story 5.5 wires the actual Resend send.
  const link = `${getAuditAppUrl()}/set-password?token=${tokenPlain}`
  const queue = getEmailNotificationQueue()
  await queue.add('auditor-welcome', {
    to: user.email,
    templateId: 'auditor-welcome',
    variables: { name: user.name, link, expiresHours: 24 },
    tenantId: rls.tenantId,
  })

  return user
}

// ─── updateUser ────────────────────────────────────────────────────────

export interface UpdateUserResult {
  user: AdminUser
  sessionsRevoked: number
  statusChanged: boolean
}

export async function updateUser(
  id: string,
  patch: UpdateUserRequest,
  ctx: ServiceContext,
): Promise<UpdateUserResult | null> {
  const rls = ctx.request.rlsContext
  if (!rls) throw new Error('updateUser requires an authenticated request')

  // Anti-self-deactivation guard.
  if (id === rls.userId && patch.status === 'INACTIVE') {
    throw new SelfDeactivationError()
  }

  return ctx.request.withRls(async (tx) => {
    let updated: AdminUser | null
    try {
      updated = await repoUpdateUser(tx, id, patch)
    } catch (err) {
      if ((err as { code?: string }).code === 'P2002') {
        throw new UserEmailConflictError()
      }
      throw err
    }
    if (!updated) return null

    let sessionsRevoked = 0
    let statusChanged = false
    if (patch.status === 'INACTIVE') {
      const res = await deleteSessionsByUserId(tx, id)
      sessionsRevoked = res.count
      statusChanged = true
    } else if (patch.status === 'ACTIVE') {
      statusChanged = true
    }

    const eventType = patch.status === 'INACTIVE'
      ? 'USER_DEACTIVATED'
      : patch.status === 'ACTIVE'
        ? 'USER_REACTIVATED'
        : 'USER_UPDATED'
    const changedFields = Object.keys(patch).filter((k) => k !== 'status')
    await appendLog(tx, {
      tenantId: rls.tenantId,
      eventType,
      payload:
        eventType === 'USER_UPDATED'
          ? { targetUserId: id, changedFields }
          : { targetUserId: id, sessionsRevoked, changedFields },
      actorUserId: rls.userId,
      actorRole: rls.role,
    })
    return { user: updated, sessionsRevoked, statusChanged }
  })
}

// ─── listUsersByRole ───────────────────────────────────────────────────

export async function listUsersByRole(
  role: UserRole,
  status: UserStatus | undefined,
  ctx: ServiceContext,
): Promise<ListUsersResponse> {
  return ctx.request.withRls((tx) => repoListUsersByRole(tx, { role, status }))
}

// ─── findUserById (admin scope) ────────────────────────────────────────

export async function adminFindUserById(
  id: string,
  ctx: ServiceContext,
): Promise<AdminUser | null> {
  const found = await ctx.request.withRls((tx) => findUserByIdInTenant(tx, id))
  if (!found) return null
  return {
    id: found.id,
    tenantId: found.tenantId,
    email: found.email,
    name: found.name,
    role: found.role,
    status: found.status,
    createdAt: '', // not on AuthUser; route can fetch via admin schema if it needs timestamps
    updatedAt: '',
  }
}

// ─── errors ────────────────────────────────────────────────────────────

export class SelfDeactivationError extends Error {
  readonly statusCode = 400
  constructor(message = 'Admins cannot deactivate themselves') {
    super(message)
    this.name = 'SelfDeactivationError'
  }
}
