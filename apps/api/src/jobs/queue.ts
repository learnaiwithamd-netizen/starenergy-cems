import { Queue, type QueueOptions } from 'bullmq'
import { getRedisConnection } from '../lib/redis.js'

const sharedOpts: Omit<QueueOptions, 'connection'> = {
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: { age: 3600, count: 1000 },
    removeOnFail: { age: 86400 },
  },
}

/**
 * Queue names. Architecture originally specified `cems:{job-type}:{priority}`
 * (colon-separated), but BullMQ 5.x rejects `:` in queue names because it uses
 * `:` as a Redis key separator internally. Adopted convention: dash-separated
 * `cems-{job-type}-{priority}`. The semantics match (3-part name with type
 * + priority); the architecture doc should be updated to reflect this.
 *
 * Story 0.4 wires only `email-notification-low`. Other queues are placeholders
 * to be activated in their feature stories (8.x calc, 8.3 LLM, 9.x PDF).
 */
export const QUEUE_NAMES = {
  emailNotification: 'cems-email-notification-low',
  calculation: 'cems-calculation-normal',
  llmReview: 'cems-llm-review-normal',
  pdfGeneration: 'cems-pdf-generation-normal',
} as const

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES]

let _queues: Record<QueueName, Queue> | undefined

export function getQueues(): Record<QueueName, Queue> {
  if (_queues) return _queues
  const connection = getRedisConnection()
  _queues = {
    [QUEUE_NAMES.emailNotification]: new Queue(QUEUE_NAMES.emailNotification, { connection, ...sharedOpts }),
    [QUEUE_NAMES.calculation]: new Queue(QUEUE_NAMES.calculation, { connection, ...sharedOpts }),
    [QUEUE_NAMES.llmReview]: new Queue(QUEUE_NAMES.llmReview, { connection, ...sharedOpts }),
    [QUEUE_NAMES.pdfGeneration]: new Queue(QUEUE_NAMES.pdfGeneration, { connection, ...sharedOpts }),
  }
  return _queues
}

export async function closeQueues(): Promise<void> {
  if (!_queues) return
  await Promise.all(Object.values(_queues).map((q) => q.close()))
  _queues = undefined
}
