import { describe, it, expect } from 'vitest'
import { surfaceUrls } from './surface-urls'

describe('surfaceUrls', () => {
  it('exposes all three SPA surfaces with dev-default URLs', () => {
    expect(surfaceUrls.audit).toBe('http://localhost:5173')
    expect(surfaceUrls.admin).toBe('http://localhost:5174')
    expect(surfaceUrls.client).toBe('http://localhost:5175')
  })

  it('object is frozen (read-only)', () => {
    expect(Object.isFrozen(surfaceUrls)).toBe(true)
  })
})
