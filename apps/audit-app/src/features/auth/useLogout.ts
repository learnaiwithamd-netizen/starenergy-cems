import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from './auth-store'
import { logoutApi } from './auth-api'
import { clearRefreshToken, getRefreshToken } from './refresh-token-store'

/**
 * Returns an async logout fn — best-effort revoke on the server, then
 * clear local session state and navigate to /login.
 */
export function useLogout(): () => Promise<void> {
  const clearSession = useAuthStore((s) => s.clearSession)
  const navigate = useNavigate()
  return useCallback(async () => {
    const refresh = getRefreshToken()
    if (refresh) {
      try {
        await logoutApi(refresh)
      } catch {
        // Best effort — never block logout on a server failure.
      }
    }
    clearRefreshToken()
    clearSession()
    navigate('/login', { replace: true })
  }, [clearSession, navigate])
}
