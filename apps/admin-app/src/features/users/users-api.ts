import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type {
  AdminUser,
  CreateUserRequest,
  ListUsersResponse,
  UpdateUserRequest,
  UserStatus,
} from '@cems/types'
import { apiFetch } from '../../lib/api-client'

const USERS_KEY = ['users'] as const

export function useUsersList(filter: { role: 'AUDITOR'; status?: UserStatus }) {
  const params = new URLSearchParams({ role: filter.role })
  if (filter.status) params.set('status', filter.status)
  return useQuery<ListUsersResponse>({
    queryKey: [...USERS_KEY, filter] as const,
    queryFn: () => apiFetch<ListUsersResponse>(`/api/v1/users?${params.toString()}`),
  })
}

export function useCreateUser() {
  const qc = useQueryClient()
  return useMutation<AdminUser, Error, CreateUserRequest>({
    mutationFn: (input) =>
      apiFetch<AdminUser>('/api/v1/users', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: USERS_KEY })
    },
  })
}

export function useUpdateUser() {
  const qc = useQueryClient()
  return useMutation<AdminUser, Error, { id: string; patch: UpdateUserRequest }>({
    mutationFn: ({ id, patch }) =>
      apiFetch<AdminUser>(`/api/v1/users/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: USERS_KEY })
    },
  })
}
