import { useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import {
  createColumnHelper,
  flexRender,
  useTable,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table'
import { Download, Search } from 'lucide-react'
import { getProjects } from '@/api/client'
import { AVAILABLE_YEARS } from '@/lib/years'
import { MONTHS, REGIONS, type AnalyzedTimeInfo, type Region } from '@/api/types'
import { useSession } from '@/lib/session-context'
import { useAsync } from '@/lib/useAsync'
import { count, money, orDash } from '@/lib/format'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { EmptyBlock, ErrorBlock, LoadingBlock } from '@/components/ui/States'
import { Sparkline } from '@/components/charts/Sparkline'
import { Pagination, PageSize, SegmentedControl, SortIcon } from '@/components/table/DataTable'
import { billingTableFeatures } from '@/components/table/features'
import { exportRows } from '@/lib/export'
import { readPreference, writePreference } from '@/lib/storage'

/* The portfolio table.
 *
 * The screen this replaces rendered 31 columns with no pagination, no pinning
 * and no summary. Here the default view is seven columns plus a sparkline,
 * and monthly detail is opt-in via the Counts / Amounts / Both control — most
 * sessions only care about dollars, so the wide view is 12 columns rather
 * than always 24.
 */

type Detail = 'none' | 'counts' | 'amounts' | 'both'

const DETAIL_KEY = 'lasb.projects.detail'
const helper = createColumnHelper<typeof billingTableFeatures, AnalyzedTimeInfo>()

/* Accessors of differing value types (string, number, string | null) do not
 * unify into a single ColumnDef because TValue is invariant. `any` is the
 * documented widening for a mixed column list; it is confined to this alias
 * and every cell renderer below is still fully typed. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ProjectColumn = ColumnDef<typeof billingTableFeatures, AnalyzedTimeInfo, any>


export function Projects() {
  const { environment, canViewTestWorkspaces } = useSession()
  const [year, setYear] = useState(AVAILABLE_YEARS[0])
  const [region, setRegion] = useState<Region>('global')
  const [includeTest, setIncludeTest] = useState(false)
  const [search, setSearch] = useState('')
  const [detail, setDetail] = useState<Detail>(
    () => (readPreference(DETAIL_KEY) as Detail) || 'none',
  )
  const [sorting, setSorting] = useState<SortingState>([{ id: 'YearCount', desc: true }])
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 25 })

  const showTest = canViewTestWorkspaces && includeTest

  const { data, loading, error, reload } = useAsync(
    () => getProjects(year, environment, showTest, region),
    [year, environment, showTest, region],
  )

  // The server appends a synthetic "Total" row (WorkspaceId -1) to the same
  // list. Pulled out here rather than left in the table's own data: sorting
  // and pagination would otherwise scatter it onto an arbitrary page, when
  // what it actually needs is a fixed spot at the bottom, on every page.
  const totalRow = data?.find((r) => r.WorkspaceId === -1) ?? null
  const tableData = useMemo(() => (data ?? []).filter((r) => r.WorkspaceId !== -1), [data])

  const setDetailPersisted = (d: Detail) => {
    writePreference(DETAIL_KEY, d)
    setDetail(d)
  }

  const columns = useMemo<ProjectColumn[]>(() => {
    const base: ProjectColumn[] = [
      helper.accessor('WorkspaceName', {
        header: 'Project Name',
        cell: (c) => (
          <Link
            to={`/projects/${c.row.original.Region.toLowerCase()}/${c.row.original.WorkspaceId}`}
            className="font-semibold text-link underline-offset-2 hover:underline"
          >
            {c.getValue()}
          </Link>
        ),
      }),
      helper.accessor('WorkspaceId', {
        header: 'Workspace ID',
        cell: (c) => <span className="font-mono text-[12.5px]">{c.getValue()}</span>,
      }),
      helper.accessor('MatterNumber', {
        header: 'Matter Number',
        cell: (c) => (
          <span className="font-mono text-[12.5px]">{c.getValue() ?? '—'}</span>
        ),
      }),
      helper.accessor('ProdType', {
        header: 'Env',
        cell: (c) => <span className="font-mono text-[12.5px]">{c.getValue()}</span>,
      }),
      helper.accessor('YearCount', {
        header: `${year} Total Billable Docs`,
        meta: { align: 'right' },
        cell: (c) => <span className="num">{count(c.getValue())}</span>,
      }),
      helper.accessor((r) => r.Money.reduce((a, b) => a + b, 0), {
        id: 'yearBilled',
        header: `${year} Billed`,
        meta: { align: 'right' },
        cell: (c) => <span className="num font-semibold">{money(c.getValue())}</span>,
      }),
      helper.display({
        id: 'shape',
        header: `${year} Shape`,
        cell: (c) => (
          <Sparkline
            values={c.row.original.Counts}
            label={`${c.row.original.WorkspaceName}, monthly documents in ${year}`}
          />
        ),
      }),
      helper.accessor('TotalBillCount', {
        header: 'Total Billable Docs',
        meta: { align: 'right' },
        cell: (c) => <span className="num">{count(c.getValue())}</span>,
      }),
      helper.accessor('TotalPrice', {
        header: 'Total Billed',
        meta: { align: 'right' },
        cell: (c) => <span className="num font-semibold">{money(c.getValue())}</span>,
      }),
    ]

    if (detail === 'none') return base

    const monthly = MONTHS.flatMap((m, i) => {
      const cols: ProjectColumn[] = []
      if (detail === 'counts' || detail === 'both') {
        cols.push(
          helper.accessor((r) => r.Counts[i], {
            id: `count-${i}`,
            header: detail === 'both' ? `${m} Docs` : m,
            meta: { align: 'right', month: true },
            cell: (c) => <span className="num">{orDash(c.getValue(), count)}</span>,
          }),
        )
      }
      if (detail === 'amounts' || detail === 'both') {
        cols.push(
          helper.accessor((r) => r.Money[i], {
            id: `money-${i}`,
            header: detail === 'both' ? `${m} $` : m,
            meta: { align: 'right', month: true, boundary: detail === 'both' },
            cell: (c) => <span className="num">{orDash(c.getValue(), money)}</span>,
          }),
        )
      }
      return cols
    })

    return [...base, ...monthly]
  }, [detail, year])

  const table = useTable({
    features: billingTableFeatures,
    data: tableData,
    columns,
    state: { sorting, globalFilter: search, pagination },
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    globalFilterFn: (row, _id, filter) => {
      const q = String(filter).toLowerCase()
      const r = row.original
      return (
        r.WorkspaceName.toLowerCase().includes(q) ||
        String(r.WorkspaceId).includes(q) ||
        (r.MatterNumber ?? '').toLowerCase().includes(q)
      )
    },
    autoResetPageIndex: true,
  })

  const rows = table.getPaginatedRowModel().rows
  const filteredCount = table.getFilteredRowModel().rows.length

  const handleExport = (format: 'csv' | 'xlsx') => {
    if (!data) return
    // Only tack the (unfiltered) Total onto a full, unsearched export — on a
    // narrowed search it would read as the total of just the visible rows,
    // which it isn't.
    const exportData = [
      ...table.getFilteredRowModel().rows.map((r) => r.original),
      ...(!search && totalRow ? [totalRow] : []),
    ]
    exportRows(`Billing_Projects_${year}_${environment}`, exportData, year, format)
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-[31px] leading-[38px] text-primary">Analytics Usage</h1>
          <p className="mt-1 text-[15px] leading-6 text-secondary">
            Document volume and billed amount for every project, by month.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => handleExport('csv')}>
            <Download className="size-4" aria-hidden="true" />
            Export to CSV
          </Button>
          <Button variant="secondary" size="sm" onClick={() => handleExport('xlsx')}>
            <Download className="size-4" aria-hidden="true" />
            Export to Excel
          </Button>
        </div>
      </header>

      <Card>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-3 border-b border-divider px-5 py-4">
          <label className="flex items-center gap-2 text-[13px] text-secondary">
            Year
            <select
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="h-8 rounded-[6px] border border-default bg-surface px-2 text-[13px] text-primary"
            >
              {AVAILABLE_YEARS.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </label>

          <label className="flex items-center gap-2 text-[13px] text-secondary">
            Region
            <select
              value={region}
              onChange={(e) => setRegion(e.target.value as Region)}
              className="h-8 rounded-[6px] border border-default bg-surface px-2 text-[13px] text-primary"
            >
              {REGIONS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </label>

          <div className="flex items-center gap-2">
            <span className="text-[13px] text-secondary">Monthly detail</span>
            <SegmentedControl<Detail>
              label="Monthly detail"
              value={detail}
              onChange={setDetailPersisted}
              options={[
                { value: 'none', label: 'Summary' },
                { value: 'counts', label: 'Counts' },
                { value: 'amounts', label: 'Amounts' },
                { value: 'both', label: 'Both' },
              ]}
            />
          </div>

          {canViewTestWorkspaces && (
            <label className="flex items-center gap-2 text-[13px] text-secondary">
              <input
                type="checkbox"
                checked={includeTest}
                onChange={(e) => setIncludeTest(e.target.checked)}
                className="size-4 cursor-pointer accent-[var(--vero-action)]"
              />
              Include test workspaces
            </label>
          )}

          <div className="ml-auto flex items-center gap-3">
            <PageSize
              value={pagination.pageSize}
              onChange={(pageSize) => setPagination({ pageIndex: 0, pageSize })}
            />
            <label className="flex items-center gap-2 text-[13px] text-secondary">
              Search:
              <span className="relative">
                <Search
                  className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted"
                  aria-hidden="true"
                />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Name, ID, or matter"
                  className="h-8 w-56 rounded-[6px] border border-default bg-surface pl-7 pr-2 text-[13px] text-primary placeholder:text-muted"
                />
              </span>
            </label>
          </div>
        </div>

        {loading ? (
          <LoadingBlock label="Loading projects" rows={8} />
        ) : error ? (
          <ErrorBlock message={error} onRetry={reload} />
        ) : filteredCount === 0 ? (
          <EmptyBlock
            title={search ? 'No projects match that search' : 'No projects to show'}
            description={
              search
                ? `Nothing matches “${search}”. Clear the search or try a workspace ID.`
                : `No project recorded activity in ${year}. Try another year.`
            }
            action={
              search ? (
                <Button variant="secondary" size="sm" onClick={() => setSearch('')}>
                  Clear Search
                </Button>
              ) : undefined
            }
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-[13px]">
                <thead>
                  <tr className="border-b border-default">
                    {table.getHeaderGroups()[0].headers.map((header, i) => {
                      const meta = header.column.columnDef.meta
                      const sorted = header.column.getIsSorted()
                      return (
                        <th
                          key={header.id}
                          scope="col"
                          aria-sort={
                            sorted === 'asc'
                              ? 'ascending'
                              : sorted === 'desc'
                                ? 'descending'
                                : header.column.getCanSort()
                                  ? 'none'
                                  : undefined
                          }
                          className={cn(
                            'whitespace-nowrap bg-surface px-3 py-2.5 text-left align-bottom font-semibold text-secondary',
                            meta?.align === 'right' && 'text-right',
                            meta?.boundary && 'border-r border-divider',
                            // Pin the project name so months scroll under it.
                            i === 0 &&
                              'sticky left-0 z-10 min-w-[220px] shadow-[1px_0_0_var(--vero-divider)]',
                          )}
                        >
                          {header.column.getCanSort() ? (
                            <button
                              type="button"
                              onClick={header.column.getToggleSortingHandler()}
                              className="inline-flex items-center gap-1 hover:text-action"
                            >
                              {flexRender(header.column.columnDef.header, header.getContext())}
                              <SortIcon dir={sorted} />
                            </button>
                          ) : (
                            flexRender(header.column.columnDef.header, header.getContext())
                          )}
                        </th>
                      )
                    })}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr
                      key={row.id}
                      /* `group` is required for the pinned first cell to pick
                         up the row hover; it is opaque, so without this it
                         stays white while the rest of the row tints. */
                      className="group border-b border-divider last:border-0 hover:bg-action-wash"
                    >
                      {row.getVisibleCells().map((cell, i) => {
                        const meta = cell.column.columnDef.meta
                        return (
                          <td
                            key={cell.id}
                            className={cn(
                              'whitespace-nowrap px-3 py-2 text-primary',
                              meta?.align === 'right' && 'text-right',
                              meta?.boundary && 'border-r border-divider',
                              i === 0 &&
                                'sticky left-0 z-10 bg-surface shadow-[1px_0_0_var(--vero-divider)] group-hover:bg-action-wash',
                            )}
                          >
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
                {totalRow && (
                  <tfoot>
                    <tr className="border-t-2 border-default bg-surface-muted font-semibold">
                      <td className="sticky left-0 z-10 bg-surface-muted px-3 py-2 text-left text-primary shadow-[1px_0_0_var(--vero-divider)]">
                        {totalRow.WorkspaceName}
                      </td>
                      <td className="px-3 py-2 font-mono text-[12.5px] text-primary">—</td>
                      <td className="px-3 py-2 font-mono text-[12.5px] text-primary">—</td>
                      <td className="px-3 py-2 font-mono text-[12.5px] text-primary">—</td>
                      <td className="num px-3 py-2 text-right text-primary">
                        {count(totalRow.YearCount)}
                      </td>
                      <td className="num px-3 py-2 text-right text-primary">
                        {money(totalRow.Money.reduce((a, b) => a + b, 0))}
                      </td>
                      <td className="px-3 py-2" />
                      <td className="num px-3 py-2 text-right text-primary">
                        {count(totalRow.TotalBillCount)}
                      </td>
                      <td className="num px-3 py-2 text-right text-primary">
                        {money(totalRow.TotalPrice)}
                      </td>
                      {detail !== 'none' &&
                        MONTHS.flatMap((_, i) => {
                          const cells: ReactNode[] = []
                          if (detail === 'counts' || detail === 'both') {
                            cells.push(
                              <td key={`c-${i}`} className="num px-3 py-2 text-right text-primary">
                                {orDash(totalRow.Counts[i], count)}
                              </td>,
                            )
                          }
                          if (detail === 'amounts' || detail === 'both') {
                            cells.push(
                              <td
                                key={`m-${i}`}
                                className={cn(
                                  'num px-3 py-2 text-right text-primary',
                                  detail === 'both' && 'border-r border-divider',
                                )}
                              >
                                {orDash(totalRow.Money[i], money)}
                              </td>,
                            )
                          }
                          return cells
                        })}
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
            <Pagination table={table} total={filteredCount} />
          </>
        )}
      </Card>
    </div>
  )
}
