import { Redis, type RedisOptions } from 'ioredis'

const redisUrl = process.env['REDIS_URL'] ?? 'redis://localhost:6379'

// BullMQ requires `maxRetriesPerRequest: null` and `enableReadyCheck: false`.
// (See: https://docs.bullmq.io/guide/connections)
const sharedOptions: RedisOptions = {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
}

let _connection: Redis | undefined

export function getRedisConnection(): Redis {
  if (_connection) return _connection
  _connection = new Redis(redisUrl, sharedOptions)
  return _connection
}

export async function closeRedisConnection(): Promise<void> {
  if (_connection) {
    await _connection.quit()
    _connection = undefined
  }
}
