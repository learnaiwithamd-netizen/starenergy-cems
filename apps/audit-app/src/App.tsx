import { Route, Routes } from 'react-router-dom'
import { LoginPage } from './features/auth/LoginPage'
import { RequireAuth } from './features/auth/RequireAuth'
import { SetPasswordPage } from './features/auth/SetPasswordPage'
import { useAuthBootstrap } from './features/auth/useAuthBootstrap'
import { StoreSelectorPage } from './features/store-selector/StoreSelectorPage'
import { AuditNewPage } from './features/audit/AuditNewPage'
import { SectionOverviewPage } from './features/audit/SectionOverviewPage'
import { SectionEditPage } from './features/audit/SectionEditPage'
import { MachineRoomGeneralPage } from './features/audit/MachineRoomGeneralPage'
import { MachineRoomVentilationPage } from './features/audit/MachineRoomVentilationPage'
import { MachineRoomExhaustPage } from './features/audit/MachineRoomExhaustPage'
import { RackListPage } from './features/audit/RackListPage'
import { RackGeneralPage } from './features/audit/RackGeneralPage'
import { CompressorListPage } from './features/audit/CompressorListPage'
import { CompressorEntryPage } from './features/audit/CompressorEntryPage'

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
            path="/audit/:auditId"
            element={
              <RequireAuth surface={SURFACE}>
                <SectionOverviewPage />
              </RequireAuth>
            }
          />
          <Route
            path="/audit/:auditId/section/refrigeration/ventilation"
            element={
              <RequireAuth surface={SURFACE}>
                <MachineRoomVentilationPage />
              </RequireAuth>
            }
          />
          <Route
            path="/audit/:auditId/section/refrigeration/exhaust"
            element={
              <RequireAuth surface={SURFACE}>
                <MachineRoomExhaustPage />
              </RequireAuth>
            }
          />
          <Route
            path="/audit/:auditId/section/refrigeration/racks"
            element={
              <RequireAuth surface={SURFACE}>
                <RackListPage />
              </RequireAuth>
            }
          />
          <Route
            path="/audit/:auditId/section/refrigeration/rack/:rackId/general"
            element={
              <RequireAuth surface={SURFACE}>
                <RackGeneralPage />
              </RequireAuth>
            }
          />
          <Route
            path="/audit/:auditId/section/refrigeration/rack/:rackId/compressors"
            element={
              <RequireAuth surface={SURFACE}>
                <CompressorListPage />
              </RequireAuth>
            }
          />
          <Route
            path="/audit/:auditId/section/refrigeration/rack/:rackId/compressor/:compressorId"
            element={
              <RequireAuth surface={SURFACE}>
                <CompressorEntryPage />
              </RequireAuth>
            }
          />
          {/* Stub for Story 3.4 condenser route (so the Compressor List "Next" lands somewhere). */}
          <Route
            path="/audit/:auditId/section/refrigeration/rack/:rackId/condenser"
            element={
              <RequireAuth surface={SURFACE}>
                <div data-testid="condenser-stub">Condenser — Story 3.4</div>
              </RequireAuth>
            }
          />
          <Route
            path="/audit/:auditId/section/refrigeration"
            element={
              <RequireAuth surface={SURFACE}>
                <MachineRoomGeneralPage />
              </RequireAuth>
            }
          />
          <Route
            path="/audit/:auditId/section/:sectionId"
            element={
              <RequireAuth surface={SURFACE}>
                <SectionEditPage />
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
