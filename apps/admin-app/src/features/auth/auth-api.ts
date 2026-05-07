/**
 * Direct fetch helpers for the auth endpoints. Intentionally do NOT use
 * the shared `apiFetch` interceptor — the api-client's 401 retry path
 * calls these helpers, so any reuse would create infinite recursion.
 *
 * All four helpers throw an `ApiError`-shaped object on non-2xx so the
 * caller can branch on `problem.type`.
 */
import type {
  LoginRequest,
  LoginResponse,
  MeResponse,
  ProblemDetail,
  RefreshRequest,
  LogoutRequest,
} from '@cems/types'

const RAW_BASE = (import.meta.env as Record<string, string | undefined>)['VITE_API_BASE_URL'] ?? 'http://localhost:3001'
const API_BASE = RAW_BASE.replace(/\/+$/, '')

export class AuthApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly problem: ProblemDetail,
  ) {
    super(problem.detail || problem.title || `HTTP ${status}`)
    this.name = 'AuthApiError'
  }
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    throw new AuthApiError(res.status, await readProblem(res))
  }
  if (res.status === 204) return undefined as T
  return (await res.json()) as T
}

async function getJson<T>(path: string, accessToken: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) {
    throw new AuthApiError(res.status, await readProblem(res))
  }
  return (await res.json()) as T
}

async function readProblem(res: Response): Promise<ProblemDetail> {
  try {
    const body = (await res.json()) as Partial<ProblemDetail>
    return {
      type: body.type ?? 'about:blank',
      title: body.title ?? res.statusText,
      status: body.status ?? res.status,
      detail: body.detail ?? res.statusText,
      ...(body.instance ? { instance: body.instance } : {}),
      ...(body.errors ? { errors: body.errors } : {}),
    }
  } catch {
    return { type: 'about:blank', title: res.statusText, status: res.status, detail: res.statusText }
  }
}

export function loginApi(body: LoginRequest): Promise<LoginResponse> {
  return postJson<LoginResponse>('/api/v1/auth/login', body)
}

export function refreshApi(refreshToken: string): Promise<LoginResponse> {
  const body: RefreshRequest = { refreshToken }
  return postJson<LoginResponse>('/api/v1/auth/refresh', body)
}

export function logoutApi(refreshToken: string): Promise<void> {
  const body: LogoutRequest = { refreshToken }
  return postJson<void>('/api/v1/auth/logout', body)
}

export function meApi(accessToken: string): Promise<MeResponse> {
  return getJson<MeResponse>('/api/v1/me', accessToken)
}
