import { Route, Routes } from 'react-router-dom'
import { LoginPage } from './features/auth/LoginPage'
import { RequireAuth } from './features/auth/RequireAuth'
import { SetPasswordPage } from './features/auth/SetPasswordPage'
import { useAuthBootstrap } from './features/auth/useAuthBootstrap'
import { StoreSelectorPage } from './features/store-selector/StoreSelectorPage'
import { AuditNewPage } from './features/audit/AuditNewPage'

const SURFACE = 'audit' as const

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
          <Route path="/login" element={<LoginPage surface={SURFACE} title="Site Audit — Sign in" />} />
          <Route path="/set-password" element={<SetPasswordPage />} />
          <Route
            path="/audit/new"
            element={
              <RequireAuth surface={SURFACE}>
                <AuditNewPage />
              </RequireAuth>
            }
          />
          <Route
            path="/*"
            element={
              <RequireAuth surface={SURFACE}>
                <StoreSelectorPage />
              </RequireAuth>
            }
          />
        </Routes>
      </main>
    </>
  )
}
