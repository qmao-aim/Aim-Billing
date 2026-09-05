import { createContext, useContext } from 'react'
import type { Environment, Role } from '@/api/types'

/* Context and hook live apart from the provider component so that
 * `session.tsx` exports only components and React Fast Refresh keeps working
 * on edit. */

export interface Session {
  role: Role
  email: string
  environment: Environment
  canViewDashboard: boolean
  canSwitchEnvironment: boolean
  canViewTestWorkspaces: boolean
  setEnvironment: (env: Environment) => void
}

export const SessionContext = createContext<Session | null>(null)

export function useSession(): Session {
  const ctx = useContext(SessionContext)
  if (!ctx) throw new Error('useSession must be used within a SessionProvider')
  return ctx
}
