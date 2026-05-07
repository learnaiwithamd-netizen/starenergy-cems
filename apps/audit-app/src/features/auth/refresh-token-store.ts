/**
 * Refresh token persistence. Stored in localStorage so it survives a hard
 * reload — required for "stay logged in" UX. Trade-off: an XSS attacker
 * who runs JS on the page can read this token. Mitigations:
 *   - Refresh tokens rotate on every successful refresh (Story 1.1) — a
 *     stolen token is single-use.
 *   - Future hardening (deferred): switch to httpOnly Secure SameSite=Strict
 *     cookie + CSRF token in headers. Requires server-side cookie handling
 *     and CSRF defence; out of scope for MVP.
 *
 * Always guard against `localStorage` being unavailable (SSR / sandboxed
 * iframe / private-browsing quirks) — every helper returns a benign value
 * on failure rather than throwing.
 */

const STORAGE_KEY = 'cems.refreshToken'

function safeStorage(): Storage | null {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage
  } catch {
    return null
  }
}

export function getRefreshToken(): string | null {
  const storage = safeStorage()
  if (!storage) return null
  try {
    return storage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

export function setRefreshToken(token: string): void {
  const storage = safeStorage()
  if (!storage) return
  try {
    storage.setItem(STORAGE_KEY, token)
  } catch {
    // Quota exceeded / private mode — silently drop. The user will be asked
    // to re-authenticate on next reload.
  }
}

export function clearRefreshToken(): void {
  const storage = safeStorage()
  if (!storage) return
  try {
    storage.removeItem(STORAGE_KEY)
  } catch {
    // ignore
  }
}
