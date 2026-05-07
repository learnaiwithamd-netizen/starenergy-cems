import { afterEach, beforeEach, describe, it, expect } from 'vitest'
import {
  clearRefreshToken,
  getRefreshToken,
  setRefreshToken,
} from './refresh-token-store'

describe('refresh-token-store', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })
  afterEach(() => {
    window.localStorage.clear()
  })

  it('round-trips a token through localStorage', () => {
    setRefreshToken('rtok-abc')
    expect(getRefreshToken()).toBe('rtok-abc')
  })

  it('returns null when no token is stored', () => {
    expect(getRefreshToken()).toBeNull()
  })

  it('clearRefreshToken removes the token', () => {
    setRefreshToken('rtok-abc')
    clearRefreshToken()
    expect(getRefreshToken()).toBeNull()
  })

  it('overwrites a previously-set token', () => {
    setRefreshToken('a')
    setRefreshToken('b')
    expect(getRefreshToken()).toBe('b')
  })

  it('uses key "cems.refreshToken" (consistent across reloads)', () => {
    setRefreshToken('rtok-xyz')
    expect(window.localStorage.getItem('cems.refreshToken')).toBe('rtok-xyz')
  })
})
