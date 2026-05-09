import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useNetworkStatus } from './useNetworkStatus'

describe('useNetworkStatus', () => {
  let originalOnLine: PropertyDescriptor | undefined

  beforeEach(() => {
    originalOnLine = Object.getOwnPropertyDescriptor(window.navigator, 'onLine')
    Object.defineProperty(window.navigator, 'onLine', {
      configurable: true,
      get: () => true,
    })
  })

  afterEach(() => {
    if (originalOnLine) Object.defineProperty(window.navigator, 'onLine', originalOnLine)
    vi.unstubAllGlobals()
  })

  it('returns initial online value from navigator.onLine', () => {
    const { result } = renderHook(() => useNetworkStatus())
    expect(result.current.online).toBe(true)
  })

  it('flips to offline on window offline event', () => {
    const { result } = renderHook(() => useNetworkStatus())
    act(() => {
      window.dispatchEvent(new Event('offline'))
    })
    expect(result.current.online).toBe(false)
  })

  it('flips back to online on window online event', () => {
    const { result } = renderHook(() => useNetworkStatus())
    act(() => {
      window.dispatchEvent(new Event('offline'))
    })
    act(() => {
      window.dispatchEvent(new Event('online'))
    })
    expect(result.current.online).toBe(true)
  })
})
