import { useMutation, useQuery } from '@tanstack/react-query'
import type {
  AuditDetail,
  AuditListItem,
  CreateAuditBody,
  CreateAuditResponse,
  ListAuditsResponse,
  PatchAuditSectionResponse,
  SectionId,
  StoreDetail,
} from '@cems/types'
import { apiFetch } from '../../lib/api-client'

const STORE_DETAIL_KEY = ['store-detail'] as const
const AUDIT_KEY = ['audits'] as const
const AUDIT_DETAIL_KEY = ['audit-detail'] as const
const IN_PROGRESS_DRAFT_KEY = ['in-progress-draft'] as const

export function useStoreDetail(storeNumber: string | null) {
  return useQuery<StoreDetail>({
    queryKey: [...STORE_DETAIL_KEY, storeNumber] as const,
    queryFn: () => apiFetch<StoreDetail>(`/api/v1/stores/${encodeURIComponent(storeNumber!)}`),
    enabled: storeNumber != null,
    staleTime: 5 * 60 * 1000,
  })
}

export function useCreateAudit() {
  return useMutation<CreateAuditResponse, Error, CreateAuditBody>({
    mutationKey: [...AUDIT_KEY, 'create'] as const,
    mutationFn: (body) =>
      apiFetch<CreateAuditResponse>('/api/v1/audits', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
  })
}

/**
 * Story 2.3 — fetches a single audit incl. all section rows. Used for
 * resume pre-fill on the Section Overview + Section Edit pages.
 */
export function useAuditDetail(auditId: string | null) {
  return useQuery<AuditDetail>({
    queryKey: [...AUDIT_DETAIL_KEY, auditId] as const,
    queryFn: () => apiFetch<AuditDetail>(`/api/v1/audits/${encodeURIComponent(auditId!)}`),
    enabled: auditId != null,
    staleTime: 30 * 1000,
  })
}

/**
 * Story 2.3 — resume detection. Returns the auditor's most-recent DRAFT
 * audit, or null if there is none. Called on the StoreSelectorPage to
 * surface the Resume CTA.
 *
 * `staleTime: 0` so a fresh check fires when the user lands on `/`. The
 * service forces `auditorUserId = caller` for AUDITOR rows, so passing
 * `auditorId=me` is a documented (and harmless) hint.
 */
export function useInProgressDraft() {
  return useQuery<ListAuditsResponse, Error, AuditListItem | null>({
    queryKey: IN_PROGRESS_DRAFT_KEY,
    queryFn: () =>
      apiFetch<ListAuditsResponse>('/api/v1/audits?status=DRAFT&auditorId=me'),
    select: (data) => (Array.isArray(data?.audits) ? data.audits[0] ?? null : null),
    staleTime: 0,
  })
}

/**
 * Mutation primitive — used by `useAutoSaveSection` directly via apiFetch.
 * Exposed here for any future consumer that needs imperative PATCHes
 * without the autosave hook (e.g., a form that wants to save on blur).
 */
export function useUpsertAuditSection() {
  return useMutation<
    PatchAuditSectionResponse,
    Error,
    { auditId: string; sectionId: SectionId; data: Record<string, unknown> }
  >({
    mutationKey: [...AUDIT_KEY, 'patch-section'] as const,
    mutationFn: ({ auditId, sectionId, data }) =>
      apiFetch<PatchAuditSectionResponse>(
        `/api/v1/audits/${encodeURIComponent(auditId)}/sections/${encodeURIComponent(sectionId)}`,
        {
          method: 'PATCH',
          body: JSON.stringify({ data }),
        },
      ),
  })
}
