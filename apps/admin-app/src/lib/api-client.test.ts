import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { apiFetch, ApiError, configureAuthBridge, __resetAuthBridgeForTests } from './api-client'

const PROBLEM_BASE = 'https://cems.starenergy.ca/errors'

function tokenExpiredResponse(): Response {
  return new Response(
    JSON.stringify({
      type: `${PROBLEM_BASE}/token-expired`,
      title: 'Unauthorized',
      status: 401,
      detail: 'Access token expired',
    }),
    { status: 401, headers: { 'Content-Type': 'application/problem+json' } },
  )
}

function authRequiredResponse(): Response {
  return new Response(
    JSON.stringify({
      type: `${PROBLEM_BASE}/authentication-required`,
      title: 'Unauthorized',
      status: 401,
      detail: 'Invalid token',
    }),
    { status: 401, headers: { 'Content-Type': 'application/problem+json' } },
  )
}

function okResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('api-client', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    __resetAuthBridgeForTests()
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    __resetAuthBridgeForTests()
  })

  it('attaches Authorization header when an access token is configured', async () => {
    configureAuthBridge({
      getAccessToken: () => 'tok-abc',
      refresh: () => Promise.reject(new Error('not used')),
      onAuthFailure: () => {},
    })
    fetchMock.mockResolvedValue(okResponse({ ok: true }))

    await apiFetch('/api/v1/me')

    expect(fetchMock).toHaveBeenCalledOnce()
    const init = fetchMock.mock.calls[0]![1] as RequestInit
    const headers = init.headers as Headers
    expect(headers.get('Authorization')).toBe('Bearer tok-abc')
  })

  it('does NOT attach Authorization header when unauthenticated', async () => {
    fetchMock.mockResolvedValue(okResponse({ ok: true }))
    await apiFetch('/api/v1/auth/login', { method: 'POST', body: JSON.stringify({}) })
    const init = fetchMock.mock.calls[0]![1] as RequestInit
    const headers = init.headers as Headers
    expect(headers.get('Authorization')).toBeNull()
  })

  it('on 401 token-expired: refreshes once, then retries the original request', async () => {
    const refreshMock = vi.fn().mockResolvedValue({
      accessToken: 'tok-new',
      refreshToken: 'rtok-new',
      tokenType: 'Bearer',
      expiresIn: 28_800,
    })
    let currentToken = 'tok-old'
    configureAuthBridge({
      getAccessToken: () => currentToken,
      refresh: async () => {
        const tokens = await refreshMock()
        currentToken = tokens.accessToken
        return tokens
      },
      onAuthFailure: () => {},
    })

    fetchMock
      .mockResolvedValueOnce(tokenExpiredResponse())
      .mockResolvedValueOnce(okResponse({ ok: true }))

    const result = await apiFetch<{ ok: boolean }>('/api/v1/me')
    expect(result).toEqual({ ok: true })
    expect(refreshMock).toHaveBeenCalledOnce()
    expect(fetchMock).toHaveBeenCalledTimes(2)
    // Retry used the new token.
    const retryInit = fetchMock.mock.calls[1]![1] as RequestInit
    expect((retryInit.headers as Headers).get('Authorization')).toBe('Bearer tok-new')
  })

  it('deduplicates concurrent 401s — refresh runs only once for parallel callers', async () => {
    const refreshMock = vi.fn().mockResolvedValue({
      accessToken: 'tok-new',
      refreshToken: 'rtok-new',
      tokenType: 'Bearer',
      expiresIn: 28_800,
    })
    let currentToken = 'tok-old'
    configureAuthBridge({
      getAccessToken: () => currentToken,
      refresh: async () => {
        const tokens = await refreshMock()
        currentToken = tokens.accessToken
        return tokens
      },
      onAuthFailure: () => {},
    })

    // Every initial request hits 401-token-expired; every retry succeeds.
    fetchMock.mockImplementation(() => {
      const tokenInUse = currentToken
      if (tokenInUse === 'tok-old') return Promise.resolve(tokenExpiredResponse())
      return Promise.resolve(okResponse({ ok: true }))
    })

    const results = await Promise.all([
      apiFetch<{ ok: boolean }>('/a'),
      apiFetch<{ ok: boolean }>('/b'),
      apiFetch<{ ok: boolean }>('/c'),
      apiFetch<{ ok: boolean }>('/d'),
      apiFetch<{ ok: boolean }>('/e'),
    ])
    expect(results.every((r) => r.ok)).toBe(true)
    // Refresh called exactly once even though 5 requests hit 401 in parallel.
    expect(refreshMock).toHaveBeenCalledTimes(1)
  })

  it('on a non-token-expired 401: does NOT refresh, fires onAuthFailure, throws', async () => {
    const refreshMock = vi.fn()
    const onAuthFailure = vi.fn()
    configureAuthBridge({
      getAccessToken: () => 'tok-old',
      refresh: refreshMock,
      onAuthFailure,
    })
    fetchMock.mockResolvedValue(authRequiredResponse())

    await expect(apiFetch('/api/v1/me')).rejects.toBeInstanceOf(ApiError)
    expect(refreshMock).not.toHaveBeenCalled()
    expect(onAuthFailure).toHaveBeenCalledOnce()
  })

  it('if refresh itself fails: fires onAuthFailure and throws the original 401', async () => {
    const refreshMock = vi.fn().mockRejectedValue(new Error('refresh exploded'))
    const onAuthFailure = vi.fn()
    configureAuthBridge({
      getAccessToken: () => 'tok-old',
      refresh: refreshMock,
      onAuthFailure,
    })
    fetchMock.mockResolvedValue(tokenExpiredResponse())

    await expect(apiFetch('/api/v1/me')).rejects.toBeInstanceOf(ApiError)
    expect(refreshMock).toHaveBeenCalledOnce()
    expect(onAuthFailure).toHaveBeenCalledOnce()
  })
})
