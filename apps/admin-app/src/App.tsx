import { Route, Routes } from 'react-router-dom'
import { Link } from 'react-router-dom'
import { Button } from '@cems/ui'
import { UserRole } from '@cems/types'
import { LoginPage } from './features/auth/LoginPage'
import { RequireAuth } from './features/auth/RequireAuth'
import { useAuthBootstrap } from './features/auth/useAuthBootstrap'
import { useAuthStore } from './features/auth/auth-store'
import { useLogout } from './features/auth/useLogout'
import { UsersPage } from './features/users/UsersPage'

const SURFACE = 'admin' as const

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
          <Route path="/login" element={<LoginPage surface={SURFACE} title="Star Energy Admin — Sign in" />} />
          <Route
            path="/users"
            element={
              <RequireAuth surface={SURFACE}>
                <UsersPage />
              </RequireAuth>
            }
          />
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
      <h1 className="text-2xl font-semibold">Admin Console</h1>
      <p className="mt-2 text-sm text-gray-600">Role demo: {UserRole.ADMIN}</p>
      {user && <p className="mt-2 text-sm">Signed in as {user.name} ({user.email})</p>}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button>Audit Queue</Button>
        <Link to="/users">
          <Button variant="outline">Manage auditors</Button>
        </Link>
        <Button variant="ghost" onClick={() => void logout()}>
          Sign out
        </Button>
      </div>
    </>
  )
}
