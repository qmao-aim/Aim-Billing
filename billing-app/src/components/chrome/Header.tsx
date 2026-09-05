import { NavLink } from 'react-router-dom'
import { useSession } from '@/lib/session-context'
import { cn } from '@/lib/utils'
import type { Environment } from '@/api/types'

/* The signature chrome.
 *
 * Gradient stops are measured from production (see vero-tokens.css). Two
 * consequences of that measurement shape this component:
 *
 * 1. White text on the gradient falls to 4.41:1 at the far right edge, below
 *    AA for normal text. Right-aligned controls therefore stop short of the
 *    final 40px (`pr-10`) and sit on solid chips rather than bare gradient.
 * 2. Nav sits on the left where contrast exceeds 12:1, so plain white text is
 *    safe there.
 *
 * No theme toggle: this build is light-only, and a visible control that does
 * nothing reads as broken. See spec §11.2.
 */

/* Suite-level wordmark.
 *
 * This app bills for every application in the Legal Analytics Suite, not for
 * Vero alone, so the lockup names the suite. Type treatment is carried over
 * from the Vero lockup unchanged: display face at 30px for the name, 11px
 * uppercase and tracked for the qualifier.
 *
 * FLAGGED: no suite lockup exists in the brand assets — this is a faithful
 * extension of the Vero one, not approved artwork. Swap it here when brand
 * supplies the real thing.
 */
function Wordmark() {
  return (
    <div className="flex select-none items-baseline gap-2.5 whitespace-nowrap">
      {/* 30px from 1280 up, which is where this tool is actually used. The
          suite name is ~3x the width of a single product name, so below that
          it steps down rather than pushing the page into horizontal scroll. */}
      <span className="font-display text-[22px] font-bold leading-none tracking-tight text-on-chrome xl:text-[30px]">
        Ankura Legal Analytics Suite
      </span>
      <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-on-chrome-muted">
        Billing
      </span>
    </div>
  )
}

// TEMPORARY: only Prod data exists to look at right now — Dev work is planned for
// later, so the switch is hidden rather than removed. Flip this back to true (or
// delete it and the guard below) once there's a real Dev environment to look at.
const SHOW_ENVIRONMENT_SWITCH = false

function EnvironmentSwitch({
  value,
  onChange,
}: {
  value: Environment
  onChange: (env: Environment) => void
}) {
  return (
    <div
      className="flex items-center gap-1 rounded-[6px] bg-[rgba(0,0,0,0.28)] p-1"
      role="group"
      aria-label="Environment"
    >
      {(['prod', 'dev'] as const).map((env) => (
        <button
          key={env}
          type="button"
          onClick={() => onChange(env)}
          aria-pressed={value === env}
          className={cn(
            'rounded-[4px] px-2.5 py-1 text-[12.5px] font-semibold transition-colors duration-[120ms]',
            value === env
              ? 'bg-on-chrome text-[#142129]'
              : 'text-on-chrome-muted hover:text-on-chrome',
          )}
        >
          {env === 'prod' ? 'Prod' : 'Dev'}
        </button>
      ))}
    </div>
  )
}

export function Header() {
  const { email, environment, canViewDashboard, canSwitchEnvironment, setEnvironment } =
    useSession()

  const navItem = ({ isActive }: { isActive: boolean }) =>
    cn(
      'rounded-[6px] px-3.5 py-2 text-[15px] font-semibold transition-colors duration-[120ms]',
      isActive
        ? 'bg-[#2F475D] text-on-chrome'
        : 'text-on-chrome-muted hover:bg-[rgba(255,255,255,0.12)] hover:text-on-chrome',
    )

  return (
    <header className="chrome-gradient">
      <div className="flex h-[76px] items-center gap-8 pl-6 pr-10">
        <Wordmark />

        <nav aria-label="Main" className="flex items-center gap-1">
          {canViewDashboard && (
            <NavLink to="/dashboard" className={navItem}>
              Dashboard
            </NavLink>
          )}
          <NavLink to="/projects" className={navItem}>
            Projects
          </NavLink>
          {canViewDashboard && (
            <NavLink to="/azure-cost" className={navItem}>
              Azure Cost
            </NavLink>
          )}
        </nav>

        <div className="ml-auto flex items-center gap-3">
          {SHOW_ENVIRONMENT_SWITCH && canSwitchEnvironment && (
            <EnvironmentSwitch value={environment} onChange={setEnvironment} />
          )}
          <span className="hidden text-[13px] text-on-chrome-muted xl:inline">{email}</span>
        </div>
      </div>
    </header>
  )
}
