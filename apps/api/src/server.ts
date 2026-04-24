import { buildApp } from './app.js'

const rawPort = process.env['PORT'] ?? '3001'
const port = Number(rawPort)
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  console.error(`[api] invalid PORT value: ${JSON.stringify(rawPort)} — expected integer 1-65535`)
  process.exit(1)
}

const host = process.env['HOST'] ?? '0.0.0.0'
const app = buildApp()

app
  .listen({ port, host })
  .then((address) => {
    app.log.info(`API listening on ${address}`)
  })
  .catch((err) => {
    app.log.error({ err }, 'failed to start API')
    process.exit(1)
  })
