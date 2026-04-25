import { afterAll, describe, expect, it, vi } from 'vitest'
import { Queue, QueueEvents, Worker } from 'bullmq'
import { Redis } from 'ioredis'
import { emailNotificationPayloadSchema, emailNotificationProcessor } from './email-notification.job.js'
import { QUEUE_NAMES } from './queue.js'

const skipSuite = process.env['RUN_INTEGRATION'] !== '1'

describe('email-notification payload validation', () => {
  it('accepts a valid payload', () => {
    const result = emailNotificationPayloadSchema.safeParse({
      to: 'user@example.com',
      templateId: 'audit-published',
      tenantId: 'tenant-a',
      variables: { auditId: 'abc' },
    })
    expect(result.success).toBe(true)
  })

  it('rejects invalid email address', () => {
    const result = emailNotificationPayloadSchema.safeParse({
      to: 'not-an-email',
      templateId: 't',
      tenantId: 'tenant-a',
    })
    expect(result.success).toBe(false)
  })

  it('rejects empty templateId', () => {
    const result = emailNotificationPayloadSchema.safeParse({
      to: 'user@example.com',
      templateId: '',
      tenantId: 'tenant-a',
    })
    expect(result.success).toBe(false)
  })

  it('processor returns delivered: true for valid payload (stub)', async () => {
    const fakeJob = {
      id: 'job-1',
      data: { to: 'user@example.com', templateId: 't', tenantId: 'tenant-a', variables: {} },
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await emailNotificationProcessor(fakeJob as any, undefined as any, undefined as any)
    expect(result).toEqual({ delivered: true })
  })
})

describe.skipIf(skipSuite)('email-notification BullMQ end-to-end (RUN_INTEGRATION=1)', () => {
  let connection: Redis
  let queue: Queue
  let worker: Worker
  let queueEvents: QueueEvents

  afterAll(async () => {
    await worker?.close()
    await queueEvents?.close()
    await queue?.close()
    await connection?.quit()
  })

  it('enqueues a job, worker processes it, returns expected payload', async () => {
    const url = process.env['REDIS_URL'] ?? 'redis://localhost:6379'
    connection = new Redis(url, { maxRetriesPerRequest: null, enableReadyCheck: false })
    const testQueue = `${QUEUE_NAMES.emailNotification}-test-${process.pid}`
    queue = new Queue(testQueue, { connection })
    queueEvents = new QueueEvents(testQueue, { connection: connection.duplicate() })
    await queueEvents.waitUntilReady()

    const processed = vi.fn(emailNotificationProcessor)
    worker = new Worker(testQueue, processed as never, { connection: connection.duplicate() })
    await worker.waitUntilReady()

    const job = await queue.add('send', {
      to: 'integration@example.com',
      templateId: 'integration-test',
      tenantId: 'tenant-a',
      variables: { check: true },
    })
    const result = await job.waitUntilFinished(queueEvents, 10_000)

    expect(result).toEqual({ delivered: true })
    expect(processed).toHaveBeenCalled()
  }, 20_000)
})
