import type { LoginResponse, ProblemDetail } from '@cems/types'

const RAW_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3001'
const API_BASE_URL = RAW_BASE.replace(/\/+$/, '')
const DEFAULT_TIMEOUT_MS = 30_000

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly problem: ProblemDetail,
  ) {
    super(problem.detail || problem.title || `HTTP ${status}`)
    this.name = 'ApiError'
  }
}

export interface ApiFetchOptions extends RequestInit {
  timeoutMs?: number
}

// ─── Auth bridge — set by the SPA at boot to inject token + refresh logic ─

let _accessTokenProvider: () => string | null = () => null
let _refreshHandler: (() => Promise<LoginResponse>) | null = null
let _onAuthFailure: (() => void) | null = null

export interface AuthBridge {
  /** Returns the current access token (or null if unauthenticated). */
  getAccessToken: () => string | null
  /** Performs the /auth/refresh round-trip and returns the new token pair.
   *  Caller MUST update the access-token store before resolving. */
  refresh: () => Promise<LoginResponse>
  /** Called when refresh fails or the original 401 wasn't a token-expired
   *  case. The SPA should clear its session state. */
  onAuthFailure: () => void
}

export function configureAuthBridge(bridge: AuthBridge): void {
  _accessTokenProvider = bridge.getAccessToken
  _refreshHandler = bridge.refresh
  _onAuthFailure = bridge.onAuthFailure
}

// Single in-flight refresh — concurrent 401s all wait on the SAME refresh.
let _inflightRefresh: Promise<LoginResponse> | null = null

function refreshOnce(): Promise<LoginResponse> {
  if (!_refreshHandler) {
    return Promise.reject(new Error('AuthBridge not configured — call configureAuthBridge at boot'))
  }
  if (_inflightRefresh) return _inflightRefresh
  const handler = _refreshHandler
  _inflightRefresh = (async () => {
    try {
      return await handler()
    } finally {
      _inflightRefresh = null
    }
  })()
  return _inflightRefresh
}

const TOKEN_EXPIRED_TYPE = 'https://cems.starenergy.ca/errors/token-expired'

export async function apiFetch<T>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  return apiFetchInternal<T>(path, options, /* hasRetried */ false)
}

async function apiFetchInternal<T>(
  path: string,
  options: ApiFetchOptions,
  hasRetried: boolean,
): Promise<T> {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, signal, body, headers, ...rest } = options

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)
  if (signal) signal.addEventListener('abort', () => controller.abort())

  const mergedHeaders = new Headers(headers)
  if (body != null && !(body instanceof FormData) && !mergedHeaders.has('Content-Type')) {
    mergedHeaders.set('Content-Type', 'application/json')
  }
  // Attach the bearer token if the SPA is authenticated.
  const token = _accessTokenProvider()
  if (token && !mergedHeaders.has('Authorization')) {
    mergedHeaders.set('Authorization', `Bearer ${token}`)
  }

  const normalizedPath = path.startsWith('/') ? path : `/${path}`

  try {
    const res = await fetch(`${API_BASE_URL}${normalizedPath}`, {
      ...rest,
      body,
      headers: mergedHeaders,
      signal: controller.signal,
    })

    if (!res.ok) {
      const problem = await parseProblemDetail(res)

      // 401 token-expired → try ONE refresh, then retry the original request.
      if (
        res.status === 401 &&
        problem.type === TOKEN_EXPIRED_TYPE &&
        !hasRetried &&
        _refreshHandler
      ) {
        try {
          await refreshOnce()
        } catch {
          if (_onAuthFailure) _onAuthFailure()
          throw new ApiError(res.status, problem)
        }
        clearTimeout(timeoutId)
        return apiFetchInternal<T>(path, options, /* hasRetried */ true)
      }

      // Any other 401 (or token-expired on retry) → clear session.
      if (res.status === 401 && _onAuthFailure) {
        _onAuthFailure()
      }
      throw new ApiError(res.status, problem)
    }

    if (res.status === 204 || res.headers.get('Content-Length') === '0') {
      return undefined as T
    }

    return (await res.json()) as T
  } finally {
    clearTimeout(timeoutId)
  }
}

async function parseProblemDetail(res: Response): Promise<ProblemDetail> {
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
    return {
      type: 'about:blank',
      title: res.statusText,
      status: res.status,
      detail: res.statusText,
    }
  }
}

// ─── Test-only helpers (do not use at runtime) ─────────────────────────
export function __resetAuthBridgeForTests(): void {
  _accessTokenProvider = () => null
  _refreshHandler = null
  _onAuthFailure = null
  _inflightRefresh = null
}
