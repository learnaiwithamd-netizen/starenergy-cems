import type { JSX } from 'react'
import { useNetworkStatus } from './useNetworkStatus'

interface OfflineBannerProps {
  lastSavedAt: string | null
}

/**
 * Persistent amber top banner shown only while `navigator.onLine === false`.
 * Returns null while online — the indicator handles all online state.
 *
 * Story 2.3 AC4: "Reconnecting… — last saved Xm ago" — no modal, no input
 * blocking. Auto-save retries on `online` event (handled by the hook).
 */
export function OfflineBanner({ lastSavedAt }: OfflineBannerProps): JSX.Element | null {
  const { online } = useNetworkStatus()
  if (online) return null

  const relative = lastSavedAt ? formatRelative(new Date(lastSavedAt), new Date()) : 'never'

  return (
    <div
      role="alert"
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
  return `${diffHr}h ago`
}
