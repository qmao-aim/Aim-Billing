import { useState } from 'react'
import { TrendingDown, TrendingUp } from 'lucide-react'
import { getAppUsage, getPortfolioTotals, getProjects } from '@/api/client'
import { AVAILABLE_YEARS } from '@/lib/years'
import { appLabel, REGIONS, type Region, type YearFilter } from '@/api/types'
import { useSession } from '@/lib/session-context'
import { useAsync } from '@/lib/useAsync'
import { count, money, percent } from '@/lib/format'
import { Card } from '@/components/ui/Card'
import { ErrorBlock, Skeleton } from '@/components/ui/States'
import { RevenueTrend } from '@/components/charts/RevenueTrend'
import { RankedBar } from '@/components/charts/RankedBar'

/* Admin landing.
 *
 * Documents and dollars are two charts, not one chart with two y-axes: the
 * application processing the most documents is routinely not the one billing
 * the most, and a dual axis would let the axis ranges invent whatever
 * relationship between them the reader wanted to see. Same category order
 * across both so the eye can compare rank directly.
 */
export function Dashboard() {
  const { environment } = useSession()
  const [year, setYear] = useState<YearFilter>(AVAILABLE_YEARS[0])
  const [region, setRegion] = useState<Region>('global')

  /* "All" reframes every figure on the page, so the labels are derived once
   * here rather than each tile guessing. "In 2026" and "all time" are not
   * interchangeable phrasings of the same number. */
  const allTime = year === 'all'
  const periodSuffix = allTime ? 'all time' : `in ${year}`
  const activityHint = allTime
    ? 'With recorded activity at any point'
    : `With recorded activity in ${year}`

  const totals = useAsync(() => getPortfolioTotals(year, environment, region), [year, environment, region])
  const apps = useAsync(() => getAppUsage(year, environment, region), [year, environment, region])
  const projects = useAsync(
    () => getProjects(year, environment, false, region),
    [year, environment, region],
  )

  // WorkspaceId -1 is the server's synthetic "Total" row, appended to the same
  // list — kept in on purpose here: since it's the sum of everything, it's
  // always >= any individual project, so it always sorts to #1 and the slice
  // below yields exactly "Total, plus the top 10 real projects" with no extra
  // logic needed.
  const topProjects = (projects.data ?? [])
    .filter((p) => p.Money.reduce((a, b) => a + b, 0) > 0)
    .map((p) => ({
      label: p.WorkspaceName,
      value: p.Money.reduce((a, b) => a + b, 0),
      secondary: { name: 'Documents', formatted: count(p.YearCount) },
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 11)

  const appItems = (apps.data ?? []).filter((a) => a.documents > 0)

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-[31px] leading-[38px] text-primary">
            Billing Dashboard
          </h1>
          <p className="mt-1 text-[15px] leading-6 text-secondary">
            Portfolio usage and billed amount across all projects.
          </p>
        </div>
        <div className="flex items-end gap-4">
          <label className="flex items-center gap-2 text-[13px] text-secondary">
            Region
            <select
              value={region}
              onChange={(e) => setRegion(e.target.value as Region)}
              className="h-9 rounded-[6px] border border-default bg-surface px-2.5 text-[14px] text-primary"
            >
              {REGIONS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 text-[13px] text-secondary">
            Period
            <select
              value={String(year)}
              onChange={(e) =>
                setYear(e.target.value === 'all' ? 'all' : Number(e.target.value))
              }
              className="h-9 rounded-[6px] border border-default bg-surface px-2.5 text-[14px] text-primary"
            >
              <option value="all">All time</option>
              {AVAILABLE_YEARS.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </label>
        </div>
      </header>

      {totals.error ? (
        <Card>
          <ErrorBlock message={totals.error} onRetry={totals.reload} />
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Stat
            label={`Billed ${periodSuffix}`}
            value={totals.data ? money(totals.data.totalBilled) : null}
            hint="Across all billable projects"
          />
          <Stat
            label={`Documents ${periodSuffix}`}
            value={totals.data ? count(totals.data.totalDocuments) : null}
            hint="Processed through all applications"
          />
          <Stat
            label="Active projects"
            value={totals.data ? String(totals.data.activeProjects) : null}
            hint={activityHint}
          />
          <Stat
            label={allTime ? 'Year over year' : 'Month over month'}
            value={totals.data ? percent(totals.data.changePct) : null}
            hint={totals.data?.changeLabel ?? ''}
            trend={totals.data?.changePct}
          />
        </div>
      )}

      {totals.data && <RevenueTrend totals={totals.data} />}

      {/* items-start: without it the single-chart column stretches to match
          the stacked pair beside it and renders ~480px of empty card. */}
      <div className="grid items-start gap-5 xl:grid-cols-2">
        {projects.error ? (
          <Card>
            <ErrorBlock message={projects.error} onRetry={projects.reload} />
          </Card>
        ) : projects.loading ? (
          <ChartSkeleton />
        ) : (
          <RankedBar
            title="Top Projects by Spend"
            description={`The portfolio total, plus the ten highest-billing projects ${periodSuffix}. Projects billed $0 (no rule set yet, or still under threshold) are left out.`}
            items={topProjects}
            format={money}
            valueColumn="Billed"
            height={420}
          />
        )}

        {apps.error ? (
          <Card>
            <ErrorBlock message={apps.error} onRetry={apps.reload} />
          </Card>
        ) : apps.loading ? (
          <ChartSkeleton />
        ) : (
          <RankedBar
            title="Documents by Application"
            description="Volume processed through each application. No per-app dollar figure exists —
              billing tiers can bundle several applications together, so a dollar split here
              would be invented, not measured."
            items={appItems.map((a) => ({ label: appLabel(a.app), value: a.documents }))}
            format={count}
            valueColumn="Documents"
            height={420}
          />
        )}
      </div>
    </div>
  )
}

function Stat({
  label,
  value,
  hint,
  trend,
}: {
  label: string
  value: string | null
  hint: string
  trend?: number
}) {
  const Trend = trend === undefined ? null : trend >= 0 ? TrendingUp : TrendingDown
  return (
    <Card className="p-5">
      <p className="text-[13px] font-semibold text-secondary">{label}</p>
      {value === null ? (
        <Skeleton className="mt-2 h-9 w-32" />
      ) : (
        <p className="mt-1 flex items-center gap-2 font-display text-[31px] leading-[38px] text-primary">
          {value}
          {Trend && (
            <Trend
              className="size-5"
              style={{ color: trend! >= 0 ? 'var(--vero-success)' : 'var(--vero-status-error)' }}
              aria-hidden="true"
            />
          )}
        </p>
      )}
      <p className="mt-1 text-[12.5px] text-secondary">{hint}</p>
    </Card>
  )
}

function ChartSkeleton() {
  return (
    <Card className="p-5">
      <Skeleton className="h-5 w-48" />
      <Skeleton className="mt-4 h-[280px] w-full" />
    </Card>
  )
}
