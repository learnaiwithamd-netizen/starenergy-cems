import { Button } from '@cems/ui'
import { AuditStatus, SECTION_LOCK_TTL_MS } from '@cems/types'

export default function App() {
  return (
    <main className="min-h-screen p-4">
      <h1 className="text-2xl font-semibold">Audit App</h1>
      <p className="mt-2 text-sm text-gray-600">
        Status demo: {AuditStatus.DRAFT} · Lock TTL: {SECTION_LOCK_TTL_MS}ms
      </p>
      <Button className="mt-4">Get started</Button>
    </main>
  )
}
