/* Session: who the user is, and which environment they are looking at.
 *
 * Wired to the real backend: `/api/session` returns the authenticated user's
 * role/email/permissions, derived server-side from their assigned Identity
 * role (Admin/PM). There is no client-settable role anymore — a session with
 * no role never reaches this far (the server's RoleGateFilter/RoleGateApiFilter
 * redirect/reject a pending user before the SPA shell or its API calls
 * succeed), and a 401 here means the cookie is missing or expired, so we bounce
 * to the real login page rather than rendering an error inside the shell.
 *
 * Permission model (spec §3):
 *   - Both roles see the full projects table, project detail, and can set rules.
 *   - Admin additionally sees the Dashboard, Azure Cost, the Prod/Dev switch, and
 *     the test-workspace filter.
 *   - Admin-only controls are HIDDEN, not disabled — see components/chrome/Header.tsx.
 */

import { useEffect, useState, type ReactNode } from 'react'
import type { Environment, Role } from '@/api/types'
import { withBasePath } from '@/lib/basePath'
import { SessionContext, type Session } from './session-context'

interface SessionResponse {
  role: Role
  email: string
  environment: Environment
  canViewDashboard: boolean
  canSwitchEnvironment: boolean
  canViewTestWorkspaces: boolean
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [info, setInfo] = useState<SessionResponse | null>(null)
  const [environment, setEnvironmentState] = useState<Environment>('prod')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    fetch(withBasePath('api/session'), { credentials: 'same-origin' })
      .then((res) => {
        if (res.status === 401) {
          window.location.href = withBasePath('Account/Login')
          return null
        }
        if (!res.ok) throw new Error(`Request failed (${res.status})`)
        return res.json() as Promise<SessionResponse>
      })
      .then((data) => {
        if (cancelled || !data) return
        setInfo(data)
        setEnvironmentState(data.environment)
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Could not load your session.')
        }
      })

    return () => {
      cancelled = true
    }
  }, [])

  if (error) {
    return (
      <div style={{ padding: 40, fontFamily: 'sans-serif' }}>
        <p>Couldn't load your session: {error}</p>
        <a href={withBasePath('Account/Login')}>Log in again</a>
      </div>
    )
  }

  if (!info) {
    return <div style={{ padding: 40, fontFamily: 'sans-serif' }}>Loading…</div>
  }

  const setEnvironment = (next: Environment) => {
    if (info.canSwitchEnvironment) {
      setEnvironmentState(next)
    }
  }

  const value: Session = {
    role: info.role,
    email: info.email,
    environment,
    canViewDashboard: info.canViewDashboard,
    canSwitchEnvironment: info.canSwitchEnvironment,
    canViewTestWorkspaces: info.canViewTestWorkspaces,
    setEnvironment,
  }

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}
