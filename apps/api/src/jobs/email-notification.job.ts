import { Worker, type Processor } from 'bullmq'
import { z } from 'zod'
import { getRedisConnection } from '../lib/redis.js'
import { logger } from '../lib/logger.js'
import { QUEUE_NAMES } from './queue.js'

/**
 * Story 0.4 ships a worker SKELETON for cems:email-notification:low.
 * Real Resend integration lands in Story 5.5 (notification feature).
 */
export const emailNotificationPayloadSchema = z.object({
  to: z.string().email(),
  templateId: z.string().min(1),
  variables: z.record(z.unknown()).default({}),
  tenantId: z.string().min(1),
  auditId: z.string().optional(),
})

export type EmailNotificationPayload = z.infer<typeof emailNotificationPayloadSchema>

export const emailNotificationProcessor: Processor<EmailNotificationPayload, { delivered: boolean }> = async (job) => {
  const payload = emailNotificationPayloadSchema.parse(job.data)
  logger.info({ jobId: job.id, to: payload.to, templateId: payload.templateId }, 'email-notification: processed (stub)')
  // Real implementation in Story 5.5:
  //   1. Render template with variables (Resend or in-house engine)
  //   2. Call Resend API with idempotency-key = job.id
  //   3. On success, append audit_log row { eventType: 'EMAIL_SENT', payload: { to, templateId } }
  //   4. On failure, BullMQ retries per attempts/backoff config
  return { delivered: true }
}

let _worker: Worker | undefined
let _workerConnection: ReturnType<ReturnType<typeof getRedisConnection>['duplicate']> | undefined

export function startEmailNotificationWorker(): Worker {
  if (_worker) return _worker
  // BullMQ docs: Workers MUST use their own connection (or a duplicate of the shared one).
  // The Worker issues blocking BRPOPLPUSH commands; sharing with non-blocking Queue clients
  // causes producer commands to queue behind the blocked socket.
  _workerConnection = getRedisConnection().duplicate()
  _worker = new Worker(QUEUE_NAMES.emailNotification, emailNotificationProcessor, {
    connection: _workerConnection,
    concurrency: 5,
  })
  _worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err }, 'email-notification job failed')
  })
  return _worker
}

export async function stopEmailNotificationWorker(): Promise<void> {
  if (_worker) {
    await _worker.close()
    _worker = undefined
  }
  if (_workerConnection) {
    await _workerConnection.quit().catch(() => undefined)
    _workerConnection = undefined
  }
}
