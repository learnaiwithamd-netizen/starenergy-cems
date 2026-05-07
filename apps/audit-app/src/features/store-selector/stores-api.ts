import { useQuery } from '@tanstack/react-query'
import type { ListStoresResponse } from '@cems/types'
import { apiFetch } from '../../lib/api-client'

const STORES_KEY = ['stores'] as const

export function useAssignedStores() {
  return useQuery<ListStoresResponse>({
    queryKey: [...STORES_KEY, { assignedToUser: true }] as const,
    queryFn: () => apiFetch<ListStoresResponse>('/api/v1/stores?assignedToUser=true'),
    staleTime: 5 * 60 * 1000,
  })
}
