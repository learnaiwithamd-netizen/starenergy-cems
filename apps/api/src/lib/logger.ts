import { pino, type LoggerOptions } from 'pino'

const isProduction = process.env['NODE_ENV'] === 'production'

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

export const logger = isProduction
  ? pino(baseOptions)
  : pino({
      ...baseOptions,
      transport: {
        target: 'pino-pretty',
        options: { colorize: true, translateTime: 'HH:MM:ss.l', ignore: 'pid,hostname,service,env' },
      },
    })
