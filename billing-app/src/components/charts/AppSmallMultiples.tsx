import { MONTHS } from '@/api/types'
import { compact, count } from '@/lib/format'
import { CHART } from './palette'
import { ChartFrame } from './ChartFrame'

export interface AppSeries {
  app: string
  counts: number[]
  total: number
}

/**
 * One mini bar chart per application, twelve months each.
 *
 * Eleven applications on a stacked chart would need eleven categorical
 * colours; Vero's palette cannot separate that many, and no reader can track
 * eleven stack segments anyway. Small multiples carry the same information
 * with a single colour, and make the shape of each application's year
 * directly comparable because every panel shares a y-scale.
 */
export function AppSmallMultiples({ series }: { series: AppSeries[] }) {
  const active = series.filter((s) => s.total > 0)
  const peak = Math.max(1, ...active.flatMap((s) => s.counts))

  return (
    <ChartFrame
      title="Monthly Volume by Application"
      description={
        active.length > 0
          ? `${active.length} of ${series.length} applications ran this year. All panels share one scale, peaking at ${compact(peak)} documents.`
          : 'No application activity recorded this year.'
      }
      tableLabel="Monthly document volume by application"
      table={{
        columns: ['Application', ...MONTHS, 'Year total'],
        rows: series.map((s) => [s.app, ...s.counts.map((c) => count(c)), count(s.total)]),
      }}
    >
      {active.length === 0 ? (
        <p className="py-8 text-center text-[14px] text-secondary">
          No documents were processed for this project in the selected year.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
          {active.map((s) => (
            <figure
              key={s.app}
              className="min-w-0 rounded-[8px] border border-default p-3"
            >
              <figcaption className="mb-1.5 flex items-baseline justify-between gap-2">
                <span className="truncate text-[13px] font-semibold text-primary">{s.app}</span>
                <span className="shrink-0 font-mono text-[12px] text-secondary">
                  {compact(s.total)}
                </span>
              </figcaption>
              <div
                className="flex items-end gap-[3px]"
                role="img"
                aria-label={`${s.app}: ${s.counts.map((c, i) => `${MONTHS[i]} ${count(c)}`).join(', ')}`}
              >
                {s.counts.map((c, i) => (
                  <div
                    key={i}
                    className="group relative flex flex-1 flex-col items-center"
                    title={`${MONTHS[i]}: ${count(c)}`}
                  >
                    <div className="flex h-16 w-full items-end">
                      <div
                        className="w-full rounded-t-[2px] transition-[height]"
                        style={{
                          height: `${Math.max(c > 0 ? 2 : 0, (c / peak) * 64)}px`,
                          background: CHART.primary,
                        }}
                      />
                    </div>
                    <span className="mt-1 text-[9px] leading-none text-muted">{i + 1}</span>
                  </div>
                ))}
              </div>
            </figure>
          ))}
        </div>
      )}
    </ChartFrame>
  )
}
