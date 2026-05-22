import { useCallback, useEffect, useRef, useState } from 'react'
import type {
  PatchAuditSectionResponse,
  SectionId,
} from '@cems/types'
import { ApiError, apiFetch } from '../../lib/api-client'

/**
 * AutoSaveState — what the indicator badge should display.
 * - `idle` / `saving`: silent (no badge — auto-save is invisible per AC1).
 * - `saved`: ✓ Saved (2 s linger then auto-fade).
 * - `error`: amber "Save failed — retrying" while retries are scheduled.
 * - `error-terminal`: red "Save failed — please reload" — final, no retry
 *   (4xx, indicating a logic/auth problem; retries would mask it).
 */
export type AutoSaveState = 'idle' | 'saving' | 'saved' | 'error' | 'error-terminal'

export interface UseAutoSaveSectionOptions {
  debounceMs?: number
  /** Override for tests — defaults to [2_000, 5_000, 15_000]. */
  retryDelaysMs?: number[]
}

export interface UseAutoSaveSectionResult {
  state: AutoSaveState
  lastSavedAt: string | null
  /** True after 2+ consecutive network/fetch failures — even if
   *  `navigator.onLine === true`. Lets the OfflineBanner surface the
   *  "API unreachable" case (captive portal, transit DNS hiccup) per AC4
   *  second trigger. */
  perceivedOffline: boolean
  save: (data: Record<string, unknown>) => void
  /** Force-send any pending debounced payload immediately. */
  flush: () => void
}

const DEFAULT_DEBOUNCE_MS = 800
const DEFAULT_RETRY_DELAYS_MS = [2_000, 5_000, 15_000] as const
const SAVED_LINGER_MS = 2_000
const PERCEIVED_OFFLINE_THRESHOLD = 2

function isRetryableError(err: unknown): boolean {
  if (err instanceof ApiError) {
    // 5xx is transient. 4xx is logic / auth — don't retry.
    return err.status >= 500
  }
  // Network drop, abort, or fetch failure → treat as retryable.
  return true
}

function isNetworkError(err: unknown): boolean {
  // Anything that isn't an ApiError is treated as a network-layer failure
  // (fetch reject, abort, DNS, TLS, etc.).
  return !(err instanceof ApiError)
}

/**
 * Story 2.3 auto-save. Returns a stable `save(data)` callback that the
 * caller invokes on every form mutation. Internally:
 *
 * 1. Coalesces successive `save(...)` calls within `debounceMs` (default 800ms).
 * 2. Sends `PATCH /api/v1/audits/:id/sections/:sectionId`.
 * 3. On 5xx / network: stays `error`, retries after 2s → 5s → 15s (cap).
 *    On 4xx: stays `error-terminal`, NO retry (logic/auth bug — masking it
 *    would hurt; user must reload).
 * 4. Listens to `window.online`; flushes any pending payload on reconnect.
 * 5. Tracks consecutive network failures; flips `perceivedOffline` after 2
 *    in a row even if `navigator.onLine === true` (P3 — covers captive
 *    portal / transit failures the OS can't detect).
 * 6. Resets all pending state when `auditId` or `sectionId` changes (P1 —
 *    prevents the previous section's pending payload from being sent to
 *    the new section/audit).
 * 7. Flushes the pending payload on unmount (P7 — best-effort cover for
 *    in-app navigation; full page-unload coverage is out of scope).
 *
 * Single-in-flight invariant: a new save during a pending one is queued
 * with the latest payload only.
 */
export function useAutoSaveSection(
  auditId: string | null,
  sectionId: SectionId,
  opts: UseAutoSaveSectionOptions = {},
): UseAutoSaveSectionResult {
  const debounceMs = opts.debounceMs ?? DEFAULT_DEBOUNCE_MS
  const retryDelaysMs = opts.retryDelaysMs ?? DEFAULT_RETRY_DELAYS_MS

  const [state, setState] = useState<AutoSaveState>('idle')
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null)
  const [perceivedOffline, setPerceivedOffline] = useState(false)

  const pendingDataRef = useRef<Record<string, unknown> | null>(null)
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const savedFadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const retryAttemptRef = useRef(0)
  const networkErrorCountRef = useRef(0)
  const inFlightRef = useRef(false)

  const clearTimer = (
    ref: React.MutableRefObject<ReturnType<typeof setTimeout> | null>,
  ): void => {
    if (ref.current) {
      clearTimeout(ref.current)
      ref.current = null
    }
  }

  const scheduleDebouncedRef = useRef<(delay: number) => void>(() => {})

  const sendNow = useCallback(async (): Promise<void> => {
    if (!auditId) return
    if (inFlightRef.current) return
    const payload = pendingDataRef.current
    if (payload === null) return

    pendingDataRef.current = null
    inFlightRef.current = true
    clearTimer(savedFadeTimerRef)
    setState('saving')

    try {
      const res = await apiFetch<PatchAuditSectionResponse>(
        `/api/v1/audits/${encodeURIComponent(auditId)}/sections/${encodeURIComponent(sectionId)}`,
        {
          method: 'PATCH',
          body: JSON.stringify({ data: payload }),
        },
      )
      retryAttemptRef.current = 0
      networkErrorCountRef.current = 0
      setPerceivedOffline(false)
      setLastSavedAt(res.savedAt)
      setState('saved')
      // Auto-fade ✓ Saved badge.
      savedFadeTimerRef.current = setTimeout(() => {
        setState((prev) => (prev === 'saved' ? 'idle' : prev))
      }, SAVED_LINGER_MS)
      // If new keystrokes landed during the in-flight save, kick off another one.
      if (pendingDataRef.current !== null) {
        scheduleDebouncedRef.current(0)
      }
    } catch (err) {
      if (isRetryableError(err)) {
        setState('error')
        // Track consecutive network failures to flip the perceived-offline
        // signal even when navigator.onLine is true (captive portal etc.).
        if (isNetworkError(err)) {
          networkErrorCountRef.current += 1
          if (networkErrorCountRef.current >= PERCEIVED_OFFLINE_THRESHOLD) {
            setPerceivedOffline(true)
          }
        }
        // Re-arm the payload so the retry sends the latest data.
        if (pendingDataRef.current === null) pendingDataRef.current = payload
        const delay =
          retryDelaysMs[Math.min(retryAttemptRef.current, retryDelaysMs.length - 1)] ??
          retryDelaysMs[retryDelaysMs.length - 1] ??
          15_000
        retryAttemptRef.current += 1
        clearTimer(retryTimerRef)
        retryTimerRef.current = setTimeout(() => {
          retryTimerRef.current = null
          void sendNow()
        }, delay)
      } else {
        // 4xx → terminal. User must reload. Clear pending so subsequent
        // keystrokes don't pile up data destined for /dev/null.
        setState('error-terminal')
        pendingDataRef.current = null
        retryAttemptRef.current = 0
      }
    } finally {
      inFlightRef.current = false
    }
  }, [auditId, sectionId, retryDelaysMs])

  const scheduleDebounced = useCallback(
    (delay: number): void => {
      clearTimer(debounceTimerRef)
      debounceTimerRef.current = setTimeout(() => {
        debounceTimerRef.current = null
        void sendNow()
      }, delay)
    },
    [sendNow],
  )

  // Keep a ref-pointer to scheduleDebounced so sendNow's success path can
  // call it without needing it in its deps (avoids a circular dep loop).
  useEffect(() => {
    scheduleDebouncedRef.current = scheduleDebounced
  }, [scheduleDebounced])

  const save = useCallback(
    (data: Record<string, unknown>): void => {
      if (!auditId) return
      // Once a terminal error has been latched, ignore further saves — the
      // user must reload. Indicator stays on "please reload" copy.
      if (state === 'error-terminal') return
      pendingDataRef.current = data
      // Cancel any in-flight retry — the user just typed; the latest save
      // attempt should use the freshest payload.
      clearTimer(retryTimerRef)
      scheduleDebounced(debounceMs)
    },
    [auditId, debounceMs, scheduleDebounced, state],
  )

  const flush = useCallback((): void => {
    clearTimer(debounceTimerRef)
    clearTimer(retryTimerRef)
    void sendNow()
  }, [sendNow])

  // P1: when auditId or sectionId changes, clear all pending state so the
  // old section's payload never gets routed to the new endpoint.
  useEffect(() => {
    return () => {
      pendingDataRef.current = null
      retryAttemptRef.current = 0
      networkErrorCountRef.current = 0
      clearTimer(debounceTimerRef)
      clearTimer(retryTimerRef)
      clearTimer(savedFadeTimerRef)
    }
  }, [auditId, sectionId])

  // Reconnect handler — flush pending payload immediately.
  useEffect(() => {
    function onOnline(): void {
      networkErrorCountRef.current = 0
      setPerceivedOffline(false)
      if (pendingDataRef.current !== null) {
        clearTimer(debounceTimerRef)
        clearTimer(retryTimerRef)
        retryAttemptRef.current = 0
        void sendNow()
      }
    }
    window.addEventListener('online', onOnline)
    return () => {
      window.removeEventListener('online', onOnline)
    }
  }, [sendNow])

  // P7: best-effort flush on unmount — covers in-app navigation. (Full
  // page-unload coverage would need keepalive + sendBeacon; out of scope
  // for 2.3.) The fetch promise floats; setState calls on the unmounted
  // component are silently dropped by React 18.
  useEffect(() => {
    return () => {
      if (pendingDataRef.current !== null) {
        void sendNow()
      }
    }
  }, [sendNow])

  return { state, lastSavedAt, perceivedOffline, save, flush }
}
