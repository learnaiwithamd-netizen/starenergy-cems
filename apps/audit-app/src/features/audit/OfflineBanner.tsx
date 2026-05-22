import type { JSX } from 'react'
import { useNetworkStatus } from './useNetworkStatus'

interface OfflineBannerProps {
  lastSavedAt: string | null
  /** P3 — secondary trigger from `useAutoSaveSection.perceivedOffline`
   *  (2+ consecutive network-error PATCHes even when navigator.onLine).
   *  Either trigger surfaces the banner. */
  perceivedOffline?: boolean
}

/**
 * Persistent amber top banner shown while EITHER `navigator.onLine` is
 * false OR the auto-save hook has flagged consecutive network failures.
 * Returns null when both signals are clear.
 *
 * Story 2.3 AC4: "Reconnecting… — last saved Xm ago" — no modal, no input
 * blocking. Auto-save retries on `online` event (handled by the hook).
 *
 * Uses `role="status"` (not `role="alert"`) because the spec calls for a
 * passive notice; `role="alert"` would force assertive announcement and
 * conflict with the `aria-live="polite"` policy used elsewhere on the
 * page (P9).
 */
export function OfflineBanner({ lastSavedAt, perceivedOffline = false }: OfflineBannerProps): JSX.Element | null {
  const { online } = useNetworkStatus()
  if (online && !perceivedOffline) return null

  const relative = lastSavedAt
    ? formatRelative(new Date(lastSavedAt), new Date())
    : 'not yet — your work is unsaved'

  return (
    <div
      role="status"
      aria-live="polite"
      className="sticky top-0 z-40 w-full bg-warning/15 px-4 py-2 text-sm text-warning border-b border-warning/30"
      data-testid="offline-banner"
    >
      Reconnecting… — last saved {relative}
    </div>
  )
}

function formatRelative(then: Date, now: Date): string {
  const diffMs = Math.max(0, now.getTime() - then.getTime())
  const diffSec = Math.floor(diffMs / 1000)
  if (diffSec < 60) return '<1m ago'
  const diffMin = Math.floor(diffSec / 60)
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `${diffHr}h ago`
  const diffDay = Math.floor(diffHr / 24)
  return `${diffDay}d ago`
}
