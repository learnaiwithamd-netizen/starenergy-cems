import { useCallback, useEffect, useRef, useState } from 'react'
import type {
  PatchAuditSectionResponse,
  SectionId,
} from '@cems/types'
import { ApiError, apiFetch } from '../../lib/api-client'

export type AutoSaveState = 'idle' | 'saving' | 'saved' | 'error'

export interface UseAutoSaveSectionOptions {
  debounceMs?: number
  /** Override for tests — defaults to [2_000, 5_000, 15_000]. */
  retryDelaysMs?: number[]
}

export interface UseAutoSaveSectionResult {
  state: AutoSaveState
  lastSavedAt: string | null
  save: (data: Record<string, unknown>) => void
  /** Force-send any pending debounced payload immediately. */
  flush: () => void
}

const DEFAULT_DEBOUNCE_MS = 800
const DEFAULT_RETRY_DELAYS_MS = [2_000, 5_000, 15_000] as const
const SAVED_LINGER_MS = 2_000

function isRetryableError(err: unknown): boolean {
  if (err instanceof ApiError) {
    // 5xx is transient. 4xx is logic / auth — don't retry.
    return err.status >= 500
  }
  // Network drop, abort, or fetch failure → treat as retryable.
  return true
}

/**
 * Story 2.3 auto-save. Returns a stable `save(data)` callback that the
 * caller invokes on every form mutation. Internally:
 *
 * 1. Coalesces successive `save(...)` calls within `debounceMs` (default 800ms).
 * 2. Sends `PATCH /api/v1/audits/:id/sections/:sectionId`.
 * 3. On 5xx / network: stays `error`, retries after 2s → 5s → 15s (cap).
 *    On 4xx: stays `error`, NO retry (logic/auth bug — masking it would hurt).
 * 4. Listens to `window.online`; flushes any pending payload on reconnect.
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

  const pendingDataRef = useRef<Record<string, unknown> | null>(null)
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const savedFadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const retryAttemptRef = useRef(0)
  const inFlightRef = useRef(false)

  const clearTimer = (ref: React.MutableRefObject<ReturnType<typeof setTimeout> | null>): void => {
    if (ref.current) {
      clearTimeout(ref.current)
      ref.current = null
    }
  }

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
      setLastSavedAt(res.savedAt)
      setState('saved')
      // Auto-fade ✓ Saved badge.
      savedFadeTimerRef.current = setTimeout(() => {
        setState((prev) => (prev === 'saved' ? 'idle' : prev))
      }, SAVED_LINGER_MS)
      // If new keystrokes landed during the in-flight save, kick off another one.
      if (pendingDataRef.current !== null) {
        scheduleDebounced(0)
      }
    } catch (err) {
      setState('error')
      if (isRetryableError(err)) {
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
      }
      // 4xx → state stays 'error', no retry; user must reload.
    } finally {
      inFlightRef.current = false
    }
  }, [auditId, sectionId])

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

  const save = useCallback(
    (data: Record<string, unknown>): void => {
      if (!auditId) return
      pendingDataRef.current = data
      // Cancel any in-flight retry — the user just typed; the latest save
      // attempt should use the freshest payload.
      clearTimer(retryTimerRef)
      scheduleDebounced(debounceMs)
    },
    [auditId, debounceMs, scheduleDebounced],
  )

  const flush = useCallback((): void => {
    clearTimer(debounceTimerRef)
    clearTimer(retryTimerRef)
    void sendNow()
  }, [sendNow])

  // Reconnect handler — flush pending payload immediately.
  useEffect(() => {
    function onOnline(): void {
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

  // Cleanup all timers on unmount.
  useEffect(() => {
    return () => {
      clearTimer(debounceTimerRef)
      clearTimer(savedFadeTimerRef)
      clearTimer(retryTimerRef)
    }
  }, [])

  return { state, lastSavedAt, save, flush }
}
