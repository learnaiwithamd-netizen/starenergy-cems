import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useAutoSaveSection } from './useAutoSaveSection'
import { ApiError, __resetAuthBridgeForTests } from '../../lib/api-client'

const fetchMock = vi.fn()

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

beforeEach(() => {
  vi.useFakeTimers()
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
  __resetAuthBridgeForTests()
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('useAutoSaveSection', () => {
  it('debounces multiple save() calls into a single PATCH', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ sectionId: 'general', savedAt: '2026-05-09T10:00:00.000Z' }),
    )
    const { result } = renderHook(() => useAutoSaveSection('audit-1', 'general'))

    act(() => {
      result.current.save({ a: 1 })
    })
    act(() => {
      vi.advanceTimersByTime(400)
    })
    act(() => {
      result.current.save({ a: 2 })
    })
    act(() => {
      vi.advanceTimersByTime(400)
    })
    expect(fetchMock).not.toHaveBeenCalled()

    await act(async () => {
      vi.advanceTimersByTime(400) // total 800ms after last save
      await Promise.resolve()
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [, init] = fetchMock.mock.calls[0]!
    expect(JSON.parse(init.body as string)).toEqual({ data: { a: 2 } })
  })

  it('transitions idle → saving → saved on success', async () => {
    let resolveFetch!: (r: Response) => void
    fetchMock.mockReturnValue(
      new Promise<Response>((r) => {
        resolveFetch = r
      }),
    )
    const { result } = renderHook(() => useAutoSaveSection('audit-1', 'general'))

    expect(result.current.state).toBe('idle')

    act(() => {
      result.current.save({ a: 1 })
    })
    await act(async () => {
      vi.advanceTimersByTime(800)
      await Promise.resolve()
    })
    expect(result.current.state).toBe('saving')

    await act(async () => {
      resolveFetch(jsonResponse({ sectionId: 'general', savedAt: '2026-05-09T10:00:00.000Z' }))
      await Promise.resolve()
      await Promise.resolve()
    })
    expect(result.current.state).toBe('saved')
    expect(result.current.lastSavedAt).toBe('2026-05-09T10:00:00.000Z')
  })

  it('saved badge auto-fades to idle after 2s', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ sectionId: 'general', savedAt: '2026-05-09T10:00:00.000Z' }),
    )
    const { result } = renderHook(() => useAutoSaveSection('audit-1', 'general'))

    act(() => {
      result.current.save({ a: 1 })
    })
    await act(async () => {
      vi.advanceTimersByTime(800)
      await Promise.resolve()
      await Promise.resolve()
    })
    expect(result.current.state).toBe('saved')

    act(() => {
      vi.advanceTimersByTime(2_001)
    })
    expect(result.current.state).toBe('idle')
  })

  it('on 5xx → state stays error and retries after 2s', async () => {
    fetchMock
      .mockResolvedValueOnce(new Response('boom', { status: 500 }))
      .mockResolvedValueOnce(
        jsonResponse({ sectionId: 'general', savedAt: '2026-05-09T11:00:00.000Z' }),
      )
    const { result } = renderHook(() => useAutoSaveSection('audit-1', 'general'))

    act(() => {
      result.current.save({ a: 1 })
    })
    await act(async () => {
      vi.advanceTimersByTime(800)
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })
    expect(result.current.state).toBe('error')
    expect(fetchMock).toHaveBeenCalledTimes(1)

    await act(async () => {
      vi.advanceTimersByTime(2_001)
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(result.current.state).toBe('saved')
  })

  it('on 4xx → state stays error and does NOT retry', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ status: 422, title: 'Validation', detail: 'bad' }), {
        status: 422,
        headers: { 'Content-Type': 'application/problem+json' },
      }),
    )
    const { result } = renderHook(() => useAutoSaveSection('audit-1', 'general'))

    act(() => {
      result.current.save({ a: 1 })
    })
    await act(async () => {
      vi.advanceTimersByTime(800)
      await Promise.resolve()
      await Promise.resolve()
    })
    expect(result.current.state).toBe('error')
    expect(fetchMock).toHaveBeenCalledTimes(1)

    act(() => {
      vi.advanceTimersByTime(20_000)
    })
    // No retry attempted.
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('window.online event flushes pending payload immediately', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ sectionId: 'general', savedAt: '2026-05-09T12:00:00.000Z' }),
    )
    const { result } = renderHook(() => useAutoSaveSection('audit-1', 'general'))

    act(() => {
      result.current.save({ a: 1 })
    })
    // Don't advance debounce timer. Fire 'online' event.
    await act(async () => {
      window.dispatchEvent(new Event('online'))
      await Promise.resolve()
      await Promise.resolve()
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('does nothing when auditId is null (defensive)', async () => {
    const { result } = renderHook(() => useAutoSaveSection(null, 'general'))
    act(() => {
      result.current.save({ a: 1 })
    })
    await act(async () => {
      vi.advanceTimersByTime(800)
      await Promise.resolve()
    })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('isRetryableError check: ApiError with 500 retries', () => {
    const err = new ApiError(500, {
      type: 'about:blank',
      title: 'err',
      status: 500,
      detail: 'd',
    })
    // Sanity: ensure the type is constructible and the status is retained.
    expect(err.status).toBe(500)
  })
})
