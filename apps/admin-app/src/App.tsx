import { Button } from '@cems/ui'
import { UserRole } from '@cems/types'

export default function App() {
  return (
    <main className="min-h-screen p-4">
      <h1 className="text-2xl font-semibold">Admin Console</h1>
      <p className="mt-2 text-sm text-gray-600">Role demo: {UserRole.ADMIN}</p>
      <Button className="mt-4">Audit Queue</Button>
    </main>
  )
}
