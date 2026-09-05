import { CheckCircle2, CircleDashed, MinusCircle } from 'lucide-react'
import { count, rate } from '@/lib/format'
import { CHART } from './palette'
import { ChartFrame } from './ChartFrame'

export interface ThresholdRow {
  app: string
  accrued: number
  threshold: number
  unitRate: number
  excluded: boolean
}

type State = 'excluded' | 'billing' | 'below' | 'inactive'

function stateOf(r: ThresholdRow): State {
  if (r.excluded) return 'excluded'
  if (r.accrued === 0) return 'inactive'
  if (r.threshold === 0 || r.accrued > r.threshold) return 'billing'
  return 'below'
}

const STATE_META: Record<State, { label: string; color: string; Icon: typeof CheckCircle2 }> = {
  billing: { label: 'Billing', color: CHART.billing, Icon: CheckCircle2 },
  below: { label: 'Below threshold', color: CHART.approaching, Icon: CircleDashed },
  excluded: { label: 'Excluded', color: '#8A949C', Icon: MinusCircle },
  inactive: { label: 'Not run', color: '#8A949C', Icon: MinusCircle },
}

/**
 * How close each application is to the point where billing starts.
 *
 * Answers "what is about to start costing money?" — invisible in the current
 * application, where thresholds are only ever seen on the rule form and never
 * against actual volume. State is carried by an icon and a label as well as
 * colour.
 */
export function ThresholdProximity({ rows }: { rows: ThresholdRow[] }) {
  const relevant = rows.filter((r) => r.accrued > 0 || r.excluded)

  return (
    <ChartFrame
      title="Billing Threshold Status"
      description="Accrued volume against the threshold at which each application starts billing."
      tableLabel="Accrued volume against billing threshold by application"
      table={{
        columns: ['Application', 'Accrued', 'Threshold', 'Rate', 'Status'],
        rows: rows.map((r) => [
          r.app,
          count(r.accrued),
          r.threshold === 0 ? 'None' : count(r.threshold),
          rate(r.unitRate),
          STATE_META[stateOf(r)].label,
        ]),
      }}
    >
      {relevant.length === 0 ? (
        <p className="py-8 text-center text-[14px] text-secondary">
          No application activity recorded this year.
        </p>
      ) : (
        <ul className="space-y-3">
          {relevant.map((r) => {
            const state = stateOf(r)
            const meta = STATE_META[state]
            const pct =
              r.threshold === 0
                ? 100
                : Math.min(100, Math.round((r.accrued / r.threshold) * 100))

            return (
              <li key={r.app}>
                <div className="flex items-baseline justify-between gap-3 text-[13px]">
                  <span className="font-semibold text-primary">{r.app}</span>
                  <span className="flex items-center gap-1.5" style={{ color: meta.color }}>
                    <meta.Icon className="size-3.5" aria-hidden="true" />
                    <span className="font-semibold">{meta.label}</span>
                  </span>
                </div>

                <div
                  className="mt-1.5 h-2 overflow-hidden rounded-full bg-surface-muted"
                  role="img"
                  aria-label={
                    r.threshold === 0
                      ? `${r.app}: no threshold, billing from the first document`
                      : `${r.app}: ${count(r.accrued)} of ${count(r.threshold)} threshold, ${pct}%`
                  }
                >
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${pct}%`, background: meta.color }}
                  />
                </div>

                <p className="mt-1 font-mono text-[11.5px] text-secondary">
                  {r.excluded
                    ? 'Excluded from billing by the project rule'
                    : r.threshold === 0
                      ? `${count(r.accrued)} documents · no threshold · ${rate(r.unitRate)}/doc`
                      : `${count(r.accrued)} of ${count(r.threshold)} · ${rate(r.unitRate)}/doc`}
                </p>
              </li>
            )
          })}
        </ul>
      )}
    </ChartFrame>
  )
}
