import type { SurfaceCode } from '@cems/types'

/**
 * Per-environment URL of each SPA surface — used by cross-surface redirects
 * (Story 1.2) when a user logs into the wrong SPA for their role.
 *
 * Dev defaults match each SPA's `vite.config.ts` server.port. Prod values
 * come from VITE_AUDIT_APP_URL / VITE_ADMIN_APP_URL / VITE_CLIENT_PORTAL_URL
 * baked into the SPA at build time.
 */
const env = (key: string, fallback: string): string => {
  const value = (import.meta.env as Record<string, string | undefined>)[key]
  return value && value.length > 0 ? value.replace(/\/+$/, '') : fallback
}

export const surfaceUrls: Readonly<Record<SurfaceCode, string>> = Object.freeze({
  audit: env('VITE_AUDIT_APP_URL', 'http://localhost:5173'),
  admin: env('VITE_ADMIN_APP_URL', 'http://localhost:5174'),
  client: env('VITE_CLIENT_PORTAL_URL', 'http://localhost:5175'),
})
