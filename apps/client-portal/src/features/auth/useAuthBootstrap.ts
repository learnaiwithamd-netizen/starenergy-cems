import { useEffect, useState } from 'react'
import { useAuthStore } from './auth-store'
import { meApi, refreshApi, AuthApiError } from './auth-api'
import {
  clearRefreshToken,
  getRefreshToken,
  setRefreshToken,
} from './refresh-token-store'

/**
 * On app mount: if a refresh token is in localStorage, exchange it for a
 * fresh access token + user profile and hydrate the store. On any failure
 * (network error, expired refresh token, deleted user), clear the token
 * and proceed unauthenticated. Returns `{ ready }` so the App can show a
 * minimal loading state until auth state is known.
 */
export function useAuthBootstrap(): { ready: boolean } {
  const [ready, setReady] = useState(false)
  const setSession = useAuthStore((s) => s.setSession)

  useEffect(() => {
    let cancelled = false

    async function hydrate() {
      const refresh = getRefreshToken()
      if (!refresh) {
        if (!cancelled) setReady(true)
        return
      }
      try {
        const tokens = await refreshApi(refresh)
        const user = await meApi(tokens.accessToken)
        if (cancelled) return
        // Persist the rotated refresh token before exposing the session.
        setRefreshToken(tokens.refreshToken)
        setSession({ accessToken: tokens.accessToken, user })
      } catch (err) {
        // Any failure path — clear the refresh token so a stale value
        // doesn't keep the user wedged across reloads.
        if (!(err instanceof AuthApiError)) {
          // Network error — don't clear; user might be offline.
        } else {
          clearRefreshToken()
        }
      } finally {
        if (!cancelled) setReady(true)
      }
    }

    void hydrate()
    return () => {
      cancelled = true
    }
  }, [setSession])

  return { ready }
}
