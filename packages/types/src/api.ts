export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
}

export interface ProblemDetail {
  type: string
  title: string
  status: number
  detail: string
  instance?: string
  errors?: Array<{ field: string; message: string }>
}

export type JobStatusValue = 'QUEUED' | 'PROCESSING' | 'COMPLETE' | 'FAILED'

export interface JobStatus {
  jobId: string
  status: JobStatusValue
  pollUrl: string
  result?: Record<string, unknown>
  error?: string
  createdAt: string
  updatedAt: string
}
