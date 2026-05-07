import { z } from 'zod'
import { UserRole } from './user.js'

// ─── TTL matrix (architecture.md Category 2) ──────────────────────────
// All values are in **seconds**.
// Auditor field sessions can run 4–6h; 8h prevents mid-audit expiry.
// Admin/Client are office/desktop bound and use shorter TTLs.
export const ACCESS_TOKEN_TTL_BY_ROLE: Readonly<Record<UserRole, number>> = Object.freeze({
  [UserRole.AUDITOR]: 8 * 60 * 60, //  8h = 28_800
  [UserRole.ADMIN]: 4 * 60 * 60, //   4h = 14_400
  [UserRole.CLIENT]: 4 * 60 * 60, //  4h = 14_400
})

export const REFRESH_TOKEN_TTL_BY_ROLE: Readonly<Record<UserRole, number>> = Object.freeze({
  [UserRole.AUDITOR]: 7 * 24 * 60 * 60, //  7d = 604_800
  [UserRole.ADMIN]: 1 * 24 * 60 * 60, //   1d =  86_400
  [UserRole.CLIENT]: 1 * 24 * 60 * 60, //  1d =  86_400
})

// ─── JWT issuer / audience ─────────────────────────────────────────────
// Address the 0-4 deferred item: jwtVerify enforces both claims so a
// token issued for a different service or by a different system is rejected.
export const JWT_ISSUER = 'cems'
export const JWT_AUDIENCE = 'cems-api'

// Cap on assigned-store-ids embedded in the JWT. SESSION_CONTEXT values are
// limited to ~256 KB on MSSQL; a 500-entry cap keeps us comfortably under
// even with long cuid-style ids. Real-world clients have ≤ a few dozen
// stores, so this is a paranoid upper bound. (0-4 deferred item.)
export const ASSIGNED_STORE_IDS_MAX = 500

// ─── Zod schemas — request/response bodies ─────────────────────────────
export const loginRequestSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(1).max(256),
})
export type LoginRequest = z.infer<typeof loginRequestSchema>

export const loginResponseSchema = z.object({
  accessToken: z.string().min(1),
  refreshToken: z.string().min(1),
  tokenType: z.literal('Bearer'),
  expiresIn: z.number().int().positive(),
})
export type LoginResponse = z.infer<typeof loginResponseSchema>

export const refreshRequestSchema = z.object({
  refreshToken: z.string().min(1),
})
export type RefreshRequest = z.infer<typeof refreshRequestSchema>

export const logoutRequestSchema = refreshRequestSchema
export type LogoutRequest = RefreshRequest

// ─── User status (Story 1.3) ───────────────────────────────────────────
export const userStatusValues = ['ACTIVE', 'INACTIVE'] as const
export type UserStatus = (typeof userStatusValues)[number]
export const userStatusSchema = z.enum(userStatusValues)

// ─── Admin user-management schemas (Story 1.3) ─────────────────────────
// Distinct from `User` in user.ts — that one is the "current logged-in user"
// shape; this is the admin-side projection (no passwordHash, includes status).
export const adminUserSchema = z.object({
  id: z.string().min(1),
  tenantId: z.string().min(1),
  email: z.string().email(),
  name: z.string().min(1),
  role: z.nativeEnum(UserRole),
  status: userStatusSchema,
  createdAt: z.string(), // ISO timestamp
  updatedAt: z.string(),
})
export type AdminUser = z.infer<typeof adminUserSchema>

export const createUserRequestSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  name: z.string().trim().min(1).max(128),
  role: z.literal(UserRole.AUDITOR), // Story 1.4 widens this to include CLIENT.
})
export type CreateUserRequest = z.infer<typeof createUserRequestSchema>

export const updateUserRequestSchema = z
  .object({
    email: z.string().trim().toLowerCase().email().max(254).optional(),
    name: z.string().trim().min(1).max(128).optional(),
    status: userStatusSchema.optional(),
  })
  .refine(
    (v) => v.email !== undefined || v.name !== undefined || v.status !== undefined,
    { message: 'At least one of email, name, or status must be provided' },
  )
export type UpdateUserRequest = z.infer<typeof updateUserRequestSchema>

export const listUsersResponseSchema = z.object({
  users: z.array(adminUserSchema),
  total: z.number().int().min(0),
})
export type ListUsersResponse = z.infer<typeof listUsersResponseSchema>

// ─── Password-set flow (Story 1.3) ─────────────────────────────────────
export const passwordSetValidateResponseSchema = z.object({
  valid: z.literal(true),
  email: z.string().email(),
})
export type PasswordSetValidateResponse = z.infer<typeof passwordSetValidateResponseSchema>

export const passwordSetRequestSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(12).max(256),
})
export type PasswordSetRequest = z.infer<typeof passwordSetRequestSchema>

// ─── /api/v1/me response (current user profile) ────────────────────────
export const meResponseSchema = z.object({
  id: z.string().min(1),
  email: z.string().email(),
  name: z.string().min(1),
  role: z.nativeEnum(UserRole),
  tenantId: z.string().min(1),
  assignedStoreIds: z.array(z.string().min(1)).max(ASSIGNED_STORE_IDS_MAX),
})
export type MeResponse = z.infer<typeof meResponseSchema>

// ─── Surface routing — role → which SPA the user belongs to ────────────
// SPA codename used as a discriminator: 'audit' = audit-app, 'admin' =
// admin-app, 'client' = client-portal. The actual URLs are env-driven
// per SPA (VITE_AUDIT_APP_URL / VITE_ADMIN_APP_URL / VITE_CLIENT_PORTAL_URL)
// so this constant only encodes the role→surface mapping, not the URL.
export type SurfaceCode = 'audit' | 'admin' | 'client'

export const SURFACE_BY_ROLE: Readonly<Record<UserRole, SurfaceCode>> = Object.freeze({
  [UserRole.AUDITOR]: 'audit',
  [UserRole.ADMIN]: 'admin',
  [UserRole.CLIENT]: 'client',
})

// ─── Access-token claims (what's signed inside the JWT) ────────────────
// Single source of truth — apps/api/src/middleware/auth.ts validates against
// this same schema on the incoming side, and apps/api/src/lib/tokens.ts
// constructs claims of this shape on the issuing side.
export const accessTokenClaimsSchema = z.object({
  sub: z.string().min(1),
  tenantId: z.string().min(1),
  role: z.nativeEnum(UserRole),
  assignedStoreIds: z.array(z.string().min(1)).max(ASSIGNED_STORE_IDS_MAX).default([]),
  // jose populates iss/aud/iat/exp.
  iss: z.literal(JWT_ISSUER),
  aud: z.literal(JWT_AUDIENCE),
  iat: z.number().int(),
  exp: z.number().int(),
})
export type AccessTokenClaims = z.infer<typeof accessTokenClaimsSchema>
