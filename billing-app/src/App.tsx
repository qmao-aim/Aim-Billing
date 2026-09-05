import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from '@/components/chrome/AppShell'
import { SessionProvider } from '@/lib/session'
import { useSession } from '@/lib/session-context'
import { Dashboard } from '@/routes/Dashboard'
import { Projects } from '@/routes/Projects'
import { ProjectDetail } from '@/routes/ProjectDetail'
import { BillingRule } from '@/routes/BillingRule'
import { AzureCost } from '@/routes/AzureCost'

/* HashRouter rather than BrowserRouter: the build is dropped onto an internal
 * server as static files, and hash routing means deep links work without an
 * IIS rewrite rule mapping every path back to index.html. */

/** Admins land on the dashboard; PMs on the projects table. */
function RoleLanding() {
  const { canViewDashboard } = useSession()
  return <Navigate to={canViewDashboard ? '/dashboard' : '/projects'} replace />
}

/** A PM reaching an admin route is redirected, not shown an error — they did
 *  not do anything wrong, the nav simply does not offer it to them. */
function AdminOnly({ children }: { children: React.ReactNode }) {
  const { canViewDashboard } = useSession()
  return canViewDashboard ? <>{children}</> : <Navigate to="/projects" replace />
}

export default function App() {
  return (
    <SessionProvider>
      <HashRouter>
        <Routes>
          <Route element={<AppShell />}>
            <Route path="/" element={<RoleLanding />} />
            <Route
              path="/dashboard"
              element={
                <AdminOnly>
                  <Dashboard />
                </AdminOnly>
              }
            />
            <Route
              path="/azure-cost"
              element={
                <AdminOnly>
                  <AzureCost />
                </AdminOnly>
              }
            />
            <Route path="/projects" element={<Projects />} />
            <Route path="/projects/:region/:id" element={<ProjectDetail />} />
            <Route path="/projects/:region/:id/rate" element={<BillingRule />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </HashRouter>
    </SessionProvider>
  )
}
