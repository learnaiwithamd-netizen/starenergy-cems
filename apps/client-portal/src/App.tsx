import { Button } from '@cems/ui'
import { AuditStatus } from '@cems/types'

export default function App() {
  return (
    <main className="min-h-screen p-4">
      <h1 className="text-2xl font-semibold">Client Portal</h1>
      <p className="mt-2 text-sm text-gray-600">Latest status: {AuditStatus.PUBLISHED}</p>
      <Button className="mt-4">View Reports</Button>
    </main>
  )
}
