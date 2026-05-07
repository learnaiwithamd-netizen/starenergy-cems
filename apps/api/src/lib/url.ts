/**
 * Server-side URL helpers. Mirror SPA-side `surface-urls.ts` but use
 * non-VITE env var names because the API runs on Node.js, not Vite.
 */

const STRIP_TRAILING_SLASHES = /\/+$/

function envUrl(key: string, fallback: string): string {
  const v = process.env[key]
  return (v && v.length > 0 ? v : fallback).replace(STRIP_TRAILING_SLASHES, '')
}

export function getAuditAppUrl(): string {
  return envUrl('AUDIT_APP_URL', 'http://localhost:5173')
}

export function getAdminAppUrl(): string {
  return envUrl('ADMIN_APP_URL', 'http://localhost:5174')
}

export function getClientPortalUrl(): string {
  return envUrl('CLIENT_PORTAL_URL', 'http://localhost:5175')
}
