import { buildApp } from './app.js'
import { logger } from './lib/logger.js'
import { closeQueues } from './jobs/queue.js'
import { startEmailNotificationWorker, stopEmailNotificationWorker } from './jobs/email-notification.job.js'
import { closeRedisConnection } from './lib/redis.js'

const rawPort = process.env['PORT'] ?? '3001'
const port = Number(rawPort)
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  logger.fatal({ raw: rawPort }, 'invalid PORT — expected integer 1-65535')
  process.exit(1)
}

const host = process.env['HOST'] ?? '0.0.0.0'

let _shuttingDown = false

async function main(): Promise<void> {
  const app = await buildApp()

  const shutdown = async (signal: string, exitCode = 0): Promise<void> => {
    if (_shuttingDown) return
    _shuttingDown = true
    logger.info({ signal }, 'shutdown initiated')
    try {
      // Order matters: stop accepting NEW requests, drain in-flight jobs, then close infra.
      await app.close()
      await stopEmailNotificationWorker()
      await closeQueues()
      await closeRedisConnection()
      logger.info('shutdown complete')
      process.exit(exitCode)
    } catch (err) {
      logger.error({ err }, 'shutdown failed')
      process.exit(1)
    }
  }

  process.on('SIGTERM', () => void shutdown('SIGTERM'))
  process.on('SIGINT', () => void shutdown('SIGINT'))
  process.on('uncaughtException', (err) => {
    logger.fatal({ err }, 'uncaughtException — initiating shutdown')
    void shutdown('uncaughtException', 1)
  })
  process.on('unhandledRejection', (reason) => {
    logger.fatal({ reason }, 'unhandledRejection — initiating shutdown')
    void shutdown('unhandledRejection', 1)
  })

  // Listen FIRST. Only start the worker after a successful HTTP listen so that a
  // listen failure (port in use, TLS error) doesn't leak a worker that's already
  // pulling jobs from Redis.
  let address: string
  try {
    address = await app.listen({ port, host })
  } catch (err) {
    logger.fatal({ err }, 'failed to start API — exiting before worker startup')
    await closeRedisConnection().catch(() => undefined)
    process.exit(1)
  }
  logger.info({ address }, 'API listening')

  startEmailNotificationWorker()
  logger.info('email-notification worker started')
}

void main()
