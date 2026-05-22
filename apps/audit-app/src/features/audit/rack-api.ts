import { useCallback, useEffect, useRef, useState, type MutableRefObject } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import type {
  CreateRackResponse,
  DuplicateRackResponse,
  GetRackResponse,
  ListRacksResponse,
  PatchRackResponse,
} from '@cems/types'
import { ApiError, apiFetch } from '../../lib/api-client'
import type { AutoSaveState } from './machine-room-api'

/** Re-export of the shared auto-save state union (Story 3.2). */
export type RackAutoSaveState = AutoSaveState

const MACHINE_ROOMS_KEY = 'machine-rooms' as const
const RACKS_KEY = 'racks' as const

function racksUrl(auditId: string, roomId: string): string {
  return `/api/v1/audits/${encodeURIComponent(auditId)}/machine-rooms/${encodeURIComponent(roomId)}/racks`
}

export function useRacks(auditId: string | null, roomId: string | null) {
  return useQuery<ListRacksResponse>({
    queryKey: ['audits', auditId, MACHINE_ROOMS_KEY, roomId, RACKS_KEY] as const,
    queryFn: () => apiFetch<ListRacksResponse>(racksUrl(auditId!, roomId!)),
    enabled: !!auditId && !!roomId,
    staleTime: 30_000,
  })
}

export function useRack(auditId: string | null, roomId: string | null, rackId: string | null) {
  return useQuery<GetRackResponse>({
    queryKey: ['audits', auditId, MACHINE_ROOMS_KEY, roomId, RACKS_KEY, rackId] as const,
    queryFn: () => apiFetch<GetRackResponse>(`${racksUrl(auditId!, roomId!)}/${encodeURIComponent(rackId!)}`),
    enabled: !!auditId && !!roomId && !!rackId,
    staleTime: 30_000,
  })
}

export function useCreateRack() {
  return useMutation<CreateRackResponse, Error, { auditId: string; roomId: string }>({
    mutationFn: ({ auditId, roomId }) =>
      apiFetch<CreateRackResponse>(racksUrl(auditId, roomId), {
        method: 'POST',
        body: JSON.stringify({}),
      }),
  })
}

export function useDuplicateRack() {
  return useMutation<DuplicateRackResponse, Error, { auditId: string; roomId: string; rackId: string }>({
    mutationFn: ({ auditId, roomId, rackId }) =>
      apiFetch<DuplicateRackResponse>(`${racksUrl(auditId, roomId)}/${encodeURIComponent(rackId)}/duplicate`, {
        method: 'POST',
        body: JSON.stringify({}),
      }),
  })
}

// ─── Auto-save hook (mirrors useAutoSaveMachineRoom) ──────────────────────────

export interface UseAutoSaveRackOptions {
  debounceMs?: number
  retryDelaysMs?: number[]
}

export interface UseAutoSaveRackResult {
  state: RackAutoSaveState
  lastSavedAt: string | null
  save: (data: Record<string, unknown>) => void
  flush: () => void
}

const DEFAULT_DEBOUNCE_MS = 800
const DEFAULT_RETRY_DELAYS_MS = [2_000, 5_000, 15_000] as const
const SAVED_LINGER_MS = 2_000

function isRetryableError(err: unknown): boolean {
  if (err instanceof ApiError) return err.status >= 500
  return true
}

export function useAutoSaveRack(
  auditId: string | null,
  roomId: string | null,
  rackId: string | null,
  opts: UseAutoSaveRackOptions = {},
): UseAutoSaveRackResult {
  const debounceMs = opts.debounceMs ?? DEFAULT_DEBOUNCE_MS
  const retryDelaysMs = opts.retryDelaysMs ?? DEFAULT_RETRY_DELAYS_MS

  const [state, setState] = useState<RackAutoSaveState>('idle')
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null)

  const pendingDataRef = useRef<Record<string, unknown> | null>(null)
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const savedFadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const retryAttemptRef = useRef(0)
  const inFlightRef = useRef(false)

  const clearTimer = (ref: MutableRefObject<ReturnType<typeof setTimeout> | null>): void => {
    if (ref.current) {
      clearTimeout(ref.current)
      ref.current = null
    }
  }

  const sendNow = useCallback(async (): Promise<void> => {
    if (!auditId || !roomId || !rackId) return
    if (inFlightRef.current) return
    const payload = pendingDataRef.current
    if (payload === null) return

    pendingDataRef.current = null
    inFlightRef.current = true
    clearTimer(savedFadeTimerRef)
    setState('saving')

    try {
      const res = await apiFetch<PatchRackResponse>(
        `${racksUrl(auditId, roomId)}/${encodeURIComponent(rackId)}`,
        { method: 'PATCH', body: JSON.stringify({ data: payload }) },
      )
      retryAttemptRef.current = 0
      setLastSavedAt(res.savedAt)
      setState('saved')
      savedFadeTimerRef.current = setTimeout(() => {
        setState((prev) => (prev === 'saved' ? 'idle' : prev))
      }, SAVED_LINGER_MS)
      if (pendingDataRef.current !== null) {
        scheduleDebounced(0)
      }
    } catch (err) {
      setState('error')
      if (isRetryableError(err)) {
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
    } finally {
      inFlightRef.current = false
    }
  }, [auditId, roomId, rackId, retryDelaysMs])

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
      if (!auditId || !roomId || !rackId) return
      pendingDataRef.current = data
      clearTimer(retryTimerRef)
      scheduleDebounced(debounceMs)
    },
    [auditId, roomId, rackId, debounceMs, scheduleDebounced],
  )

  const flush = useCallback((): void => {
    clearTimer(debounceTimerRef)
    clearTimer(retryTimerRef)
    void sendNow()
  }, [sendNow])

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
    return () => window.removeEventListener('online', onOnline)
  }, [sendNow])

  useEffect(() => {
    return () => {
      clearTimer(debounceTimerRef)
      clearTimer(savedFadeTimerRef)
      clearTimer(retryTimerRef)
    }
  }, [])

  return { state, lastSavedAt, save, flush }
}
