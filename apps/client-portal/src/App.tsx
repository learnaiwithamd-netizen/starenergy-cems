import { Route, Routes } from 'react-router-dom'
import { Button } from '@cems/ui'
import { AuditStatus } from '@cems/types'
import { LoginPage } from './features/auth/LoginPage'
import { RequireAuth } from './features/auth/RequireAuth'
import { useAuthBootstrap } from './features/auth/useAuthBootstrap'
import { useAuthStore } from './features/auth/auth-store'
import { useLogout } from './features/auth/useLogout'

const SURFACE = 'client' as const

export default function App() {
  const { ready } = useAuthBootstrap()

  if (!ready) {
    return (
      <main id="main-content" tabIndex={-1} className="min-h-screen p-4">
        <p>Loading…</p>
      </main>
    )
  }

  return (
    <>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:bg-primary focus:text-primary-foreground focus:px-4 focus:py-2 focus:rounded focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
      >
        Skip to main content
      </a>
      <main id="main-content" tabIndex={-1} className="min-h-screen p-4">
        <Routes>
          <Route path="/login" element={<LoginPage surface={SURFACE} title="Star Energy Client Portal — Sign in" />} />
          <Route
            path="/*"
            element={
              <RequireAuth surface={SURFACE}>
                <Home />
              </RequireAuth>
            }
          />
        </Routes>
      </main>
    </>
  )
}

function Home() {
  const user = useAuthStore((s) => s.user)
  const logout = useLogout()
  return (
    <>
      <h1 className="text-2xl font-semibold">Client Portal</h1>
      <p className="mt-2 text-sm text-gray-600">Latest status: {AuditStatus.PUBLISHED}</p>
      {user && <p className="mt-2 text-sm">Signed in as {user.name} ({user.email})</p>}
      <Button className="mt-4">View Reports</Button>
      <Button variant="ghost" className="ml-2 mt-4" onClick={() => void logout()}>
        Sign out
      </Button>
    </>
  )
}
