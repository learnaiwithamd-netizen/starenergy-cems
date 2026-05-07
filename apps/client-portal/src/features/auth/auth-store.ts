import { create } from 'zustand'
import type { MeResponse } from '@cems/types'

/**
 * Auth state held in MEMORY only. The access token lives here for the
 * lifetime of the page; on a hard reload it gets re-derived from the
 * persisted refresh token (see `useAuthBootstrap`).
 *
 * Refresh tokens are persisted separately via `refresh-token-store.ts`
 * (localStorage). See Dev Notes in the 1.2 story file for the security
 * trade-off.
 */
export interface AuthState {
  accessToken: string | null
  user: MeResponse | null
  setSession: (input: { accessToken: string; user: MeResponse }) => void
  setUser: (user: MeResponse) => void
  setAccessToken: (token: string) => void
  clearSession: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  user: null,
  setSession: ({ accessToken, user }) => set({ accessToken, user }),
  setUser: (user) => set({ user }),
  setAccessToken: (accessToken) => set({ accessToken }),
  clearSession: () => set({ accessToken: null, user: null }),
}))
