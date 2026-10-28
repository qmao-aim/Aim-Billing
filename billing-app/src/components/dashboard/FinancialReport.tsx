import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Download } from 'lucide-react'
import { getFinancialReport } from '@/api/client'
import { FIRST_YEAR } from '@/lib/years'
import { MONTHS, type Region } from '@/api/types'
import { useSession } from '@/lib/session-context'
import { useAsync } from '@/lib/useAsync'
import { count, moneyExact, rate } from '@/lib/format'
import { exportFinancialReport } from '@/lib/export'
import { Card, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { EmptyBlock, ErrorBlock, LoadingBlock } from '@/components/ui/States'

/**
 * "Monthly Report for Financial Department": one row per workspace per billed
 * tier for a single selected month (not the page's own year/all-time period),
 * since Finance reconciles month by month. Rows with nothing billed that
 * month are left out entirely — see DashboardRepository.GetFinancialReport.
 */

const now = new Date()
/** Newest first, "2026 Oct" .. "2019 Jan" — every month the platform could
 *  plausibly have data for, not just ones known to have billing activity, so
 *  the dropdown doesn't have to round-trip the server first to build itself. */
const MONTH_OPTIONS = (() => {
  const options: { year: number; month: number; label: string }[] = []
  for (let y = now.getFullYear(); y >= FIRST_YEAR; y--) {
    const lastMonth = y === now.getFullYear() ? now.getMonth() + 1 : 12
    for (let m = lastMonth; m >= 1; m--) {
      options.push({ year: y, month: m, label: `${y} ${MONTHS[m - 1]}` })
    }
  }
  return options
})()

export function FinancialReport({ region }: { region: Region }) {
  const { environment } = useSession()
  const [periodKey, setPeriodKey] = useState(`${MONTH_OPTIONS[0].year}-${MONTH_OPTIONS[0].month}`)
  const [year, month] = periodKey.split('-').map(Number)

  const report = useAsync(
    () => getFinancialReport(environment, region, year, month),
    [environment, region, year, month],
  )
  const rows = report.data ?? []
  const periodLabel = MONTH_OPTIONS.find((o) => o.year === year && o.month === month)?.label ?? periodKey

  return (
    <Card>
      <CardHeader
        title="Monthly Report for Financial Department"
        description={`Documents and dollars billed per workspace, by tier, in ${periodLabel}.`}
        actions={
          <>
            <label className="flex items-center gap-2 text-[13px] text-secondary">
              Month
              <select
                value={periodKey}
                onChange={(e) => setPeriodKey(e.target.value)}
                className="h-9 rounded-[6px] border border-default bg-surface px-2.5 text-[14px] text-primary"
              >
                {MONTH_OPTIONS.map((o) => (
                  <option key={`${o.year}-${o.month}`} value={`${o.year}-${o.month}`}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            <Button
              variant="secondary"
              size="sm"
              disabled={rows.length === 0}
              onClick={() => exportFinancialReport(`Financial_Report_${periodLabel.replace(' ', '_')}`, rows, 'xlsx')}
            >
              <Download className="size-4" aria-hidden="true" />
              Export to Excel
            </Button>
          </>
        }
      />
      {report.loading ? (
        <LoadingBlock label="Loading financial report" rows={6} />
      ) : report.error ? (
        <ErrorBlock message={report.error} onRetry={report.reload} />
      ) : rows.length === 0 ? (
        <EmptyBlock
          title="Nothing billed that month"
          description={`No workspace billed a non-zero amount in ${periodLabel}.`}
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr className="border-b border-default">
                <th scope="col" className="whitespace-nowrap px-4 py-2.5 text-left font-semibold text-secondary">
                  Workspace ID
                </th>
                <th scope="col" className="px-3 py-2.5 text-left font-semibold text-secondary">
                  Workspace Name
                </th>
                <th scope="col" className="whitespace-nowrap px-3 py-2.5 text-left font-semibold text-secondary">
                  Matter Number
                </th>
                <th scope="col" className="whitespace-nowrap px-3 py-2.5 text-left font-semibold text-secondary">
                  Region
                </th>
                <th scope="col" className="px-3 py-2.5 text-left font-semibold text-secondary">
                  Applications
                </th>
                <th scope="col" className="whitespace-nowrap px-3 py-2.5 text-right font-semibold text-secondary">
                  Doc Count
                </th>
                <th scope="col" className="whitespace-nowrap px-3 py-2.5 text-right font-semibold text-secondary">
                  Dollar Amount
                </th>
                <th scope="col" className="whitespace-nowrap px-3 py-2.5 text-right font-semibold text-secondary">
                  Unit Price
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={`${r.workspaceId}-${i}`} className="border-b border-divider last:border-0 hover:bg-action-wash">
                  <td className="whitespace-nowrap px-4 py-2 font-mono text-[12.5px] text-primary">
                    {r.workspaceId}
                  </td>
                  <td className="px-3 py-2 text-primary">
                    <Link
                      to={`/projects/${r.region.toLowerCase()}/${r.workspaceId}`}
                      className="font-semibold text-link underline-offset-2 hover:underline"
                    >
                      {r.workspaceName}
                    </Link>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-primary">{r.matterNumber ?? '—'}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-primary">{r.region}</td>
                  <td className="max-w-[240px] px-3 py-2 text-primary">
                    <span className="block truncate" title={r.applications.join(', ')}>
                      {r.applications.join(', ') || '—'}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right text-primary">{count(r.docCount)}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-right text-primary">{moneyExact(r.dollarAmount)}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-right text-primary">{rate(r.unitPrice)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  )
}
