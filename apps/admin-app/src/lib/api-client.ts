import type { ProblemDetail } from '@cems/types'

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

export async function apiFetch<T>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, signal, body, headers, ...rest } = options

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)
  if (signal) signal.addEventListener('abort', () => controller.abort())

  const mergedHeaders = new Headers(headers)
  if (body != null && !(body instanceof FormData) && !mergedHeaders.has('Content-Type')) {
    mergedHeaders.set('Content-Type', 'application/json')
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
