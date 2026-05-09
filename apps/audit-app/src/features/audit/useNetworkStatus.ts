import { useEffect, useState } from 'react'

/**
 * Tracks `navigator.onLine` via the standard `online` / `offline` events.
 * SSR-safe: returns `online: true` when `window` is undefined (e.g.,
 * during a hypothetical Vite SSR pass).
 */
export function useNetworkStatus(): { online: boolean } {
  const [online, setOnline] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true
    return window.navigator?.onLine ?? true
  })

  useEffect(() => {
    if (typeof window === 'undefined') return
    function handleOnline(): void {
      setOnline(true)
    }
    function handleOffline(): void {
      setOnline(false)
    }
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  return { online }
}
