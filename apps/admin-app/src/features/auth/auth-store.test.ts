import { beforeEach, describe, it, expect } from 'vitest'
import { UserRole } from '@cems/types'
import { useAuthStore } from './auth-store'

const sampleUser = {
  id: 'u-1',
  email: 'auditor@cems.local',
  name: 'Dev Auditor',
  role: UserRole.AUDITOR,
  tenantId: 'tenant-a',
  assignedStoreIds: ['store-1'],
}

describe('useAuthStore', () => {
  beforeEach(() => {
    useAuthStore.getState().clearSession()
  })

  it('starts unauthenticated (accessToken=null, user=null)', () => {
    const s = useAuthStore.getState()
    expect(s.accessToken).toBeNull()
    expect(s.user).toBeNull()
  })

  it('setSession populates both accessToken and user', () => {
    useAuthStore.getState().setSession({ accessToken: 'tok-1', user: sampleUser })
    const s = useAuthStore.getState()
    expect(s.accessToken).toBe('tok-1')
    expect(s.user).toEqual(sampleUser)
  })

  it('setAccessToken updates only the access token', () => {
    useAuthStore.getState().setSession({ accessToken: 'tok-1', user: sampleUser })
    useAuthStore.getState().setAccessToken('tok-2')
    const s = useAuthStore.getState()
    expect(s.accessToken).toBe('tok-2')
    expect(s.user).toEqual(sampleUser)
  })

  it('clearSession nulls everything', () => {
    useAuthStore.getState().setSession({ accessToken: 'tok-1', user: sampleUser })
    useAuthStore.getState().clearSession()
    const s = useAuthStore.getState()
    expect(s.accessToken).toBeNull()
    expect(s.user).toBeNull()
  })
})
