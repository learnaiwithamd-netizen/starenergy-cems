import { Button } from '@cems/ui'
import { AuditStatus } from '@cems/types'

export default function App() {
  return (
    <>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:bg-primary focus:text-primary-foreground focus:px-4 focus:py-2 focus:rounded focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
      >
        Skip to main content
      </a>
      <main id="main-content" tabIndex={-1} className="min-h-screen p-4">
        <h1 className="text-2xl font-semibold">Client Portal</h1>
        <p className="mt-2 text-sm text-gray-600">Latest status: {AuditStatus.PUBLISHED}</p>
        <Button className="mt-4">View Reports</Button>
      </main>
    </>
  )
}
