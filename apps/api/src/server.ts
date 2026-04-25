import { buildApp } from './app.js'
import { logger } from './lib/logger.js'
import { closeQueues } from './jobs/queue.js'
import { startEmailNotificationWorker, stopEmailNotificationWorker } from './jobs/email-notification.job.js'
import { closeRedisConnection } from './lib/redis.js'

const rawPort = process.env['PORT'] ?? '3001'
const port = Number(rawPort)
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  console.error(`[api] invalid PORT value: ${JSON.stringify(rawPort)} — expected integer 1-65535`)
  process.exit(1)
}

const host = process.env['HOST'] ?? '0.0.0.0'

async function main(): Promise<void> {
  const app = await buildApp()

  startEmailNotificationWorker()
  logger.info('email-notification worker started')

  const shutdown = async (signal: string): Promise<void> => {
    logger.info({ signal }, 'shutdown initiated')
    try {
      await app.close()
      await stopEmailNotificationWorker()
      await closeQueues()
      await closeRedisConnection()
      logger.info('shutdown complete')
      process.exit(0)
    } catch (err) {
      logger.error({ err }, 'shutdown failed')
      process.exit(1)
    }
  }

  process.on('SIGTERM', () => void shutdown('SIGTERM'))
  process.on('SIGINT', () => void shutdown('SIGINT'))

  try {
    const address = await app.listen({ port, host })
    logger.info({ address }, 'API listening')
  } catch (err) {
    logger.error({ err }, 'failed to start API')
    process.exit(1)
  }
}

void main()
