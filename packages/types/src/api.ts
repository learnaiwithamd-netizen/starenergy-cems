export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
}

import { z } from 'zod'

export interface ProblemDetail {
  type: string
  title: string
  status: number
  detail: string
  instance?: string
  errors?: Array<{ field: string; message: string }>
}

export const problemDetailSchema = z.object({
  type: z.string().url(),
  title: z.string().min(1),
  status: z.number().int().min(400).max(599),
  detail: z.string(),
  instance: z.string().optional(),
  errors: z
    .array(z.object({ field: z.string(), message: z.string() }))
    .optional(),
}) satisfies z.ZodType<ProblemDetail>

export type ProblemDetailInput = z.infer<typeof problemDetailSchema>

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
