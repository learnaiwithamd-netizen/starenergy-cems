import { useCallback, useEffect, useRef, useState, type MutableRefObject } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import type {
  CreateCompressorResponse,
  DuplicateCompressorResponse,
  GetCompressorRefResponse,
  GetCompressorResponse,
  ListCompressorsResponse,
  PatchCompressorBody,
  PatchCompressorResponse,
  ReportUnknownModelResponse,
} from '@cems/types'
import { ApiError, apiFetch } from '../../lib/api-client'
import type { AutoSaveState } from './machine-room-api'

/** Re-export of the shared auto-save state union (Story 3.3). */
export type CompressorAutoSaveState = AutoSaveState

const MACHINE_ROOMS_KEY = 'machine-rooms' as const
const RACKS_KEY = 'racks' as const
const COMPRESSORS_KEY = 'compressors' as const

function compressorsUrl(auditId: string, roomId: string, rackId: string): string {
  return `/api/v1/audits/${encodeURIComponent(auditId)}/machine-rooms/${encodeURIComponent(
    roomId,
  )}/racks/${encodeURIComponent(rackId)}/compressors`
}

export function useCompressors(auditId: string | null, roomId: string | null, rackId: string | null) {
  return useQuery<ListCompressorsResponse>({
    queryKey: ['audits', auditId, MACHINE_ROOMS_KEY, roomId, RACKS_KEY, rackId, COMPRESSORS_KEY] as const,
    queryFn: () => apiFetch<ListCompressorsResponse>(compressorsUrl(auditId!, roomId!, rackId!)),
    enabled: !!auditId && !!roomId && !!rackId,
    staleTime: 30_000,
  })
}

export function useCompressor(
  auditId: string | null,
  roomId: string | null,
  rackId: string | null,
  compressorId: string | null,
) {
  return useQuery<GetCompressorResponse>({
    queryKey: ['audits', auditId, MACHINE_ROOMS_KEY, roomId, RACKS_KEY, rackId, COMPRESSORS_KEY, compressorId] as const,
    queryFn: () =>
      apiFetch<GetCompressorResponse>(
        `${compressorsUrl(auditId!, roomId!, rackId!)}/${encodeURIComponent(compressorId!)}`,
      ),
    enabled: !!auditId && !!roomId && !!rackId && !!compressorId,
    staleTime: 30_000,
  })
}

export function useCreateCompressor() {
  return useMutation<CreateCompressorResponse, Error, { auditId: string; roomId: string; rackId: string }>({
    mutationFn: ({ auditId, roomId, rackId }) =>
      apiFetch<CreateCompressorResponse>(compressorsUrl(auditId, roomId, rackId), {
        method: 'POST',
        body: JSON.stringify({}),
      }),
  })
}

export function useDuplicateCompressor() {
  return useMutation<
    DuplicateCompressorResponse,
    Error,
    { auditId: string; roomId: string; rackId: string; compressorId: string }
  >({
    mutationFn: ({ auditId, roomId, rackId, compressorId }) =>
      apiFetch<DuplicateCompressorResponse>(
        `${compressorsUrl(auditId, roomId, rackId)}/${encodeURIComponent(compressorId)}/duplicate`,
        { method: 'POST', body: JSON.stringify({}) },
      ),
  })
}

export function useReportUnknownModel() {
  return useMutation<
    ReportUnknownModelResponse,
    Error,
    { auditId: string; roomId: string; rackId: string; compressorId: string }
  >({
    mutationFn: ({ auditId, roomId, rackId, compressorId }) =>
      apiFetch<ReportUnknownModelResponse>(
        `${compressorsUrl(auditId, roomId, rackId)}/${encodeURIComponent(compressorId)}/report-unknown-model`,
        { method: 'POST', body: JSON.stringify({}) },
      ),
  })
}

/**
 * Compressor regression-DB lookup. `retry: false` because a 404 (model not
 * found) is an expected branch, not a transient error — the caller inspects
 * `error instanceof ApiError && error.status === 404`.
 */
export function useCompressorRefLookup(model: string | null) {
  const trimmed = model?.trim() ?? ''
  return useQuery<GetCompressorRefResponse>({
    queryKey: ['compressor-ref', trimmed] as const,
    queryFn: () => apiFetch<GetCompressorRefResponse>(`/api/v1/compressors/${encodeURIComponent(trimmed)}`),
    enabled: trimmed.length > 0,
    retry: false,
    staleTime: 5 * 60_000,
  })
}

// ─── Auto-save hook (mirrors useAutoSaveRack; body also carries compressorRefId) ─

export interface UseAutoSaveCompressorOptions {
  debounceMs?: number
  retryDelaysMs?: number[]
}

export interface UseAutoSaveCompressorResult {
  state: CompressorAutoSaveState
  lastSavedAt: string | null
  save: (payload: PatchCompressorBody) => void
  flush: () => void
}

const DEFAULT_DEBOUNCE_MS = 800
const DEFAULT_RETRY_DELAYS_MS = [2_000, 5_000, 15_000] as const
const SAVED_LINGER_MS = 2_000

function isRetryableError(err: unknown): boolean {
  if (err instanceof ApiError) return err.status >= 500
  return true
}

export function useAutoSaveCompressor(
  auditId: string | null,
  roomId: string | null,
  rackId: string | null,
  compressorId: string | null,
  opts: UseAutoSaveCompressorOptions = {},
): UseAutoSaveCompressorResult {
  const debounceMs = opts.debounceMs ?? DEFAULT_DEBOUNCE_MS
  const retryDelaysMs = opts.retryDelaysMs ?? DEFAULT_RETRY_DELAYS_MS

  const [state, setState] = useState<CompressorAutoSaveState>('idle')
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null)

  const pendingDataRef = useRef<PatchCompressorBody | null>(null)
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
    if (!auditId || !roomId || !rackId || !compressorId) return
    if (inFlightRef.current) return
    const payload = pendingDataRef.current
    if (payload === null) return

    pendingDataRef.current = null
    inFlightRef.current = true
    clearTimer(savedFadeTimerRef)
    setState('saving')

    try {
      const res = await apiFetch<PatchCompressorResponse>(
        `${compressorsUrl(auditId, roomId, rackId)}/${encodeURIComponent(compressorId)}`,
        { method: 'PATCH', body: JSON.stringify(payload) },
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
  }, [auditId, roomId, rackId, compressorId, retryDelaysMs])

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
    (payload: PatchCompressorBody): void => {
      if (!auditId || !roomId || !rackId || !compressorId) return
      pendingDataRef.current = payload
      clearTimer(retryTimerRef)
      scheduleDebounced(debounceMs)
    },
    [auditId, roomId, rackId, compressorId, debounceMs, scheduleDebounced],
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
