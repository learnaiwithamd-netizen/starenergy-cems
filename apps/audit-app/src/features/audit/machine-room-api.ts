import { useCallback, useEffect, useRef, useState, type MutableRefObject } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import type {
  CreateMachineRoomResponse,
  ListMachineRoomsResponse,
  PatchMachineRoomResponse,
} from '@cems/types'
import { ApiError, apiFetch } from '../../lib/api-client'

const MACHINE_ROOMS_KEY = 'machine-rooms' as const

export function useMachineRooms(auditId: string | null) {
  return useQuery<ListMachineRoomsResponse>({
    queryKey: ['audits', auditId, MACHINE_ROOMS_KEY] as const,
    queryFn: () =>
      apiFetch<ListMachineRoomsResponse>(
        `/api/v1/audits/${encodeURIComponent(auditId!)}/machine-rooms`,
      ),
    enabled: !!auditId,
    staleTime: 30_000,
  })
}

export function useGetOrCreateMachineRoom() {
  return useMutation<CreateMachineRoomResponse, Error, { auditId: string }>({
    mutationFn: ({ auditId }) =>
      apiFetch<CreateMachineRoomResponse>(
        `/api/v1/audits/${encodeURIComponent(auditId)}/machine-rooms`,
        { method: 'POST', body: JSON.stringify({}) },
      ),
  })
}

// ─── Auto-save hook (adapted from useAutoSaveSection) ─────────────────────────

export type AutoSaveState = 'idle' | 'saving' | 'saved' | 'error'

export interface UseAutoSaveMachineRoomOptions {
  debounceMs?: number
  retryDelaysMs?: number[]
}

export interface UseAutoSaveMachineRoomResult {
  state: AutoSaveState
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

export function useAutoSaveMachineRoom(
  auditId: string | null,
  roomId: string | null,
  opts: UseAutoSaveMachineRoomOptions = {},
): UseAutoSaveMachineRoomResult {
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

  const clearTimer = (ref: MutableRefObject<ReturnType<typeof setTimeout> | null>): void => {
    if (ref.current) {
      clearTimeout(ref.current)
      ref.current = null
    }
  }

  const sendNow = useCallback(async (): Promise<void> => {
    if (!auditId || !roomId) return
    if (inFlightRef.current) return
    const payload = pendingDataRef.current
    if (payload === null) return

    pendingDataRef.current = null
    inFlightRef.current = true
    clearTimer(savedFadeTimerRef)
    setState('saving')

    try {
      const res = await apiFetch<PatchMachineRoomResponse>(
        `/api/v1/audits/${encodeURIComponent(auditId)}/machine-rooms/${encodeURIComponent(roomId)}`,
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
  }, [auditId, roomId, retryDelaysMs])

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
      if (!auditId || !roomId) return
      pendingDataRef.current = data
      clearTimer(retryTimerRef)
      scheduleDebounced(debounceMs)
    },
    [auditId, roomId, debounceMs, scheduleDebounced],
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
