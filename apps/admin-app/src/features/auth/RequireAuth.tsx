import { useEffect, type JSX, type ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { SURFACE_BY_ROLE, type SurfaceCode } from '@cems/types'
import { useAuthStore } from './auth-store'
import { surfaceUrls } from '../../lib/surface-urls'

export interface RequireAuthProps {
  /** Which SPA we're guarding — used to detect role/surface mismatch. */
  surface: SurfaceCode
  children: ReactNode
}

/**
 * Route guard. Three branches:
 *   1. Unauthenticated → Navigate to /login?next=<original> (in-SPA).
 *   2. Authenticated but role's surface ≠ this SPA → window.location.assign
 *      to the correct surface (cross-SPA, full-page redirect). Render null
 *      while the navigation happens.
 *   3. Authenticated + role matches → render children.
 *
 * Security note: this is a UX guard, NOT a security boundary. The API's
 * requireRole + JWT auth hook enforce server-side role checks; the worst a
 * user with dev-tools open can do is render the protected components, but
 * every API call those components make still hits a 401/403.
 */
export function RequireAuth({ surface, children }: RequireAuthProps): JSX.Element | null {
  const user = useAuthStore((s) => s.user)
  const location = useLocation()

  const correctSurface = user ? SURFACE_BY_ROLE[user.role] : null
  const surfaceMismatch = correctSurface !== null && correctSurface !== surface

  useEffect(() => {
    if (surfaceMismatch && correctSurface) {
      window.location.assign(`${surfaceUrls[correctSurface]}/login`)
    }
  }, [surfaceMismatch, correctSurface])

  if (!user) {
    const next = encodeURIComponent(location.pathname + location.search)
    return <Navigate to={`/login?next=${next}`} replace />
  }
  if (surfaceMismatch) {
    return null
  }
  return <>{children}</>
}
