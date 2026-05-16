import { pino, type LoggerOptions } from 'pino'

// Use JSON logging in all non-development environments (staging, production).
// pino-pretty uses a worker thread; if the process crashes before the worker
// flushes, all buffered log lines are lost. JSON pino writes synchronously.
const isJsonEnv = process.env['NODE_ENV'] !== 'development'

const baseOptions: LoggerOptions = {
  level: process.env['LOG_LEVEL'] ?? 'info',
  base: {
    service: 'cems-api',
    env: process.env['NODE_ENV'] ?? 'development',
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'request.headers.authorization',
      'request.headers.cookie',
      '*.password',
      '*.passwordHash',
      '*.secret',
      '*.token',
      '*.refreshToken',
      '*.refreshTokenHash',
      '*.jwt',
      '*.apiKey',
    ],
    censor: '[REDACTED]',
  },
}

export const logger = isJsonEnv
  ? pino(baseOptions)
  : pino({
      ...baseOptions,
      transport: {
        target: 'pino-pretty',
        options: { colorize: true, translateTime: 'HH:MM:ss.l', ignore: 'pid,hostname,service,env' },
      },
    })
