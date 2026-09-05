import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Download, Settings2 } from 'lucide-react'
import { getBillingRule, getProjectDetail, getRateDistribution } from '@/api/client'
import { AVAILABLE_YEARS } from '@/lib/years'
import { appLabel, MONTHS, type AnalyzedTimeInfo, type Region } from '@/api/types'
import { useSession } from '@/lib/session-context'
import { useAsync } from '@/lib/useAsync'
import { count, dateTime, money, orDash, rate } from '@/lib/format'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { Card, CardHeader } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { EmptyBlock, ErrorBlock, LoadingBlock } from '@/components/ui/States'
import { AppSmallMultiples } from '@/components/charts/AppSmallMultiples'
import { ThresholdProximity } from '@/components/charts/ThresholdProximity'
import { RateContext } from '@/components/charts/RateContext'
import { exportProjectDetail } from '@/lib/export'

export function ProjectDetail() {
  const { id, region: regionParam } = useParams()
  const workspaceId = Number(id)
  // A project always belongs to one specific region — this comes from the URL
  // (set when navigating from the Projects list, which knows each row's real
  // region even when its own filter is 'global'), never from a page-level
  // Global/US/UK selector.
  const region = regionParam as Region
  const { environment } = useSession()
  const [year, setYear] = useState(AVAILABLE_YEARS[0])
  const [measure, setMeasure] = useState<'counts' | 'amounts'>('counts')

  const detail = useAsync(
    () => getProjectDetail(workspaceId, year, environment, region),
    [workspaceId, year, environment, region],
  )
  const ruleQuery = useAsync(
    () => getBillingRule(workspaceId, environment, region),
    [workspaceId, environment, region],
  )
  const rates = useAsync(() => getRateDistribution(environment, region), [environment, region])

  const rows = detail.data ?? []
  // The server still computes this (it's the source for the page header's project
  // name/matter number and the rate-context chart's unit price) — it just isn't
  // shown as its own row in the breakdown table below.
  const totalRow = rows.find((r) => r.JobName === 'All applications')
  // Rows in server order: "All applications" first, then (when a rule is defined)
  // a tier-grouped breakdown — a tier's subtotal row immediately followed by its
  // member applications. bodyRows drives the on-screen table: it drops the total
  // row above, and drops Vero's app row specifically — Vero's tier only ever has
  // the one member (Chat/Vero itself), so showing both the tier subtotal and the
  // identical per-app row right under it is pure duplication. appRows stays
  // IsAppRow-only and keeps Vero, for anything that must see every real
  // application (charts, threshold proximity) — JobName can't be used for that
  // distinction since Vero's dedicated tier is literally named "Chat".
  const bodyRows = rows.filter((r) => r !== totalRow && !(r.IsAppRow && r.JobName === 'Chat'))
  const appRows = rows.filter((r) => r.IsAppRow)
  const rule = ruleQuery.data

  if (!detail.loading && !detail.error && rows.length === 0) {
    return (
      <Card>
        <EmptyBlock
          title="Project not found"
          description={`No project with workspace ID ${workspaceId} exists in the ${environment === 'prod' ? 'Prod' : 'Dev'} environment in the ${region.toUpperCase()} region.`}
          action={
            <Link to="/projects">
              <Button variant="secondary" size="sm">
                Back to Projects
              </Button>
            </Link>
          }
        />
      </Card>
    )
  }

  return (
    <div className="space-y-5">
      <Link
        to="/projects"
        className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-link hover:underline"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        All projects
      </Link>

      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-display text-[31px] leading-[38px] text-primary">
            {totalRow?.WorkspaceName ?? 'Project'}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[12.5px] text-secondary">
            <span>ID {workspaceId}</span>
            <span>{region.toUpperCase()}</span>
            {totalRow?.MatterNumber && <span>Matter {totalRow.MatterNumber}</span>}
            {totalRow?.ProdType && <span>{totalRow.ProdType}</span>}
            {rule?.createdOn && <span>Rule set {dateTime(rule.createdOn)}</span>}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-[13px] text-secondary">
            Year
            <select
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="h-9 rounded-[6px] border border-default bg-surface px-2.5 text-[14px] text-primary"
            >
              {AVAILABLE_YEARS.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </label>
          <Link to={`/projects/${region}/${workspaceId}/rate`}>
            <Button variant="secondary" size="sm">
              <Settings2 className="size-4" aria-hidden="true" />
              {rule?.isDefined === -1 ? 'Set Billing Rule' : 'View Billing Rule'}
            </Button>
          </Link>
        </div>
      </header>

      {rule && (
        <div className="flex flex-wrap items-center gap-3">
          {rule.isDefined === -1 ? (
            <Badge tone="warning">No billing rule set</Badge>
          ) : rule.isTest ? (
            <Badge tone="neutral">Non-billable test workspace</Badge>
          ) : (
            <>
              <Badge tone="success">Billable</Badge>
              <span className="text-[13px] text-secondary">
                {rule.sameUnitPrice
                  ? `Flat rate ${rate(rule.unitPrice)} per document`
                  : 'Tiered rates by application'}
                {rule.isAppExcluded && ' · some applications excluded'}
              </span>
            </>
          )}
        </div>
      )}

      <Card>
        <CardHeader
          title="Analytics Usage"
          description={`Documents processed by each application in ${year}.`}
          actions={
            <>
              <div className="flex items-center rounded-[6px] border border-default p-0.5">
                {(['counts', 'amounts'] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMeasure(m)}
                    aria-pressed={measure === m}
                    className={cn(
                      'rounded-[4px] px-3 py-1.5 text-[13px] font-semibold transition-colors',
                      measure === m
                        ? 'bg-action text-on-action'
                        : 'text-secondary hover:bg-action-wash',
                    )}
                  >
                    {m === 'counts' ? 'Documents' : 'Amount'}
                  </button>
                ))}
              </div>
              <Button
                variant="secondary"
                size="sm"
                disabled={rows.length === 0}
                onClick={() =>
                  exportProjectDetail(
                    `Billing_${totalRow?.WorkspaceName ?? workspaceId}_${year}`,
                    rows,
                    year,
                    'xlsx',
                  )
                }
              >
                <Download className="size-4" aria-hidden="true" />
                Export to Excel
              </Button>
            </>
          }
        />
        {detail.loading ? (
          <LoadingBlock label="Loading usage" rows={6} />
        ) : detail.error ? (
          <ErrorBlock message={detail.error} onRetry={detail.reload} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[13px]">
              <thead>
                <tr className="border-b border-default">
                  <th
                    scope="col"
                    className="sticky left-0 z-10 bg-surface px-4 py-2.5 text-left font-semibold text-secondary shadow-[1px_0_0_var(--vero-divider)]"
                  >
                    Application
                  </th>
                  <th scope="col" className="px-3 py-2.5 text-right font-semibold text-secondary">
                    Lifetime
                  </th>
                  <th scope="col" className="border-r border-divider px-3 py-2.5 text-right font-semibold text-secondary">
                    {year}
                  </th>
                  {MONTHS.map((m) => (
                    <th key={m} scope="col" className="px-3 py-2.5 text-right font-semibold text-secondary">
                      {m}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {bodyRows.map((row, i) => (
                  <UsageRow
                    key={`${row.JobName}-${i}`}
                    row={row}
                    measure={measure}
                    kind={row.IsAppRow ? 'app' : 'group'}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {!detail.loading && !detail.error && (
        <AppSmallMultiples
          series={appRows.map((r) => ({
            app: appLabel(r.JobName),
            counts: r.Counts,
            total: r.YearCount,
          }))}
        />
      )}

      <div className="grid items-start gap-5 xl:grid-cols-2">
        {!detail.loading && rule && rule.isDefined !== -1 && !rule.isTest && (
          <ThresholdProximity
            rows={appRows.map((r) => ({
              app: appLabel(r.JobName),
              accrued: r.YearCount,
              threshold: r.JobThreshold,
              unitRate: r.JobUnitRate,
              // Keyed by the raw JobName, matching jobExcludeList's own keys —
              // `app` above is only the display label, never used for lookups.
              excluded: rule.isAppExcluded && rule.jobExcludeList[r.JobName],
            }))}
          />
        )}
        {rates.data && rule && rule.isDefined === 0 && !rule.isTest && (
          <RateContext
            projectRate={rule.sameUnitPrice ? rule.unitPrice : (totalRow?.UnitPrice ?? 0)}
            distribution={rates.data}
          />
        )}
      </div>
    </div>
  )
}

function UsageRow({
  row,
  measure,
  kind,
}: {
  row: AnalyzedTimeInfo
  measure: 'counts' | 'amounts'
  kind: 'group' | 'app'
}) {
  const values = measure === 'counts' ? row.Counts : row.Money
  const fmt = measure === 'counts' ? count : money

  return (
    <tr
      className={cn(
        'border-b border-divider last:border-0',
        kind === 'group' ? 'bg-surface-muted font-semibold' : 'hover:bg-action-wash',
      )}
    >
      <th
        scope="row"
        className={cn(
          'sticky left-0 z-10 px-4 py-2 text-left font-semibold text-primary shadow-[1px_0_0_var(--vero-divider)]',
          kind === 'group' ? 'bg-surface-muted' : 'bg-surface pl-7',
        )}
      >
        {appLabel(row.JobName)}
      </th>
      <td className="num px-3 py-2 text-right text-secondary">
        {measure === 'counts'
          ? count(row.TotalCount)
          : orDash(row.TotalPrice < 0 ? null : row.TotalPrice, money)}
      </td>
      <td className="num border-r border-divider px-3 py-2 text-right text-primary">
        {measure === 'counts'
          ? count(row.YearCount)
          : orDash(values.reduce((a, b) => a + b, 0), money)}
      </td>
      {values.map((v, i) => (
        <td key={i} className="num px-3 py-2 text-right text-primary">
          {orDash(v, fmt)}
        </td>
      ))}
    </tr>
  )
}
