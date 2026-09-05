import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  createColumnHelper,
  flexRender,
  useTable,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table'
import { Search } from 'lucide-react'
import { getImageCaptionCosts, getLlmChatCosts, getSummarizationCosts } from '@/api/client'
import { AVAILABLE_YEARS } from '@/lib/years'
import {
  appLabel,
  MONTHS,
  REGIONS,
  type ImageCaptionCost,
  type LlmChatCost,
  type Region,
  type SummarizationCost,
  type YearFilter,
} from '@/api/types'
import { useAsync } from '@/lib/useAsync'
import { compact, count, money } from '@/lib/format'
import { cn } from '@/lib/utils'
import { Card, CardHeader } from '@/components/ui/Card'
import { EmptyBlock, ErrorBlock, LoadingBlock } from '@/components/ui/States'
import { RankedBar } from '@/components/charts/RankedBar'
import { ChartFrame } from '@/components/charts/ChartFrame'
import { CHART } from '@/components/charts/palette'
import { Pagination, PageSize, SortIcon } from '@/components/table/DataTable'
import { billingTableFeatures, type ColumnMeta } from '@/components/table/features'

/**
 * Azure/AI compute cost — what Ankura pays Azure/OpenAI to run Vero, Summarization,
 * and Image Caption. A different concern from every other page in this app, which
 * shows what a CLIENT is billed (BillingRule/tier_info) — these three cost categories
 * are internal spend, tracked in their own rollup tables with no relationship to a
 * project's billing rule.
 *
 * No Environment (Prod/Dev) control here: unlike every other table this app reads,
 * llm_rollup / SummarizationJobBilling / ipa_caption_rollup have no `_Dev` variant —
 * confirmed directly against both regional databases. They only ever track Prod.
 */

const sum = <T,>(rows: T[] | null, f: (r: T) => number): number => (rows ?? []).reduce((a, r) => a + f(r), 0)

function monthlyTotals<T>(rows: T[], getMonth: (r: T) => number, getValue: (r: T) => number): number[] {
  const totals = new Array(12).fill(0)
  for (const r of rows) {
    const m = getMonth(r)
    if (m >= 1 && m <= 12) totals[m - 1] += getValue(r)
  }
  return totals
}

const addArrays = (a: number[], b: number[]) => a.map((v, i) => v + (b[i] ?? 0))

// Shared by both Summarization split tables (Mine_Summarization Cost / Privilege
// Narrator Cost) — same row shape and columns either way, since each table is now
// pre-filtered to a single appName rather than mixing both under one "App Name" column.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function summarizationColumns(helper: ReturnType<typeof createColumnHelper<typeof billingTableFeatures, SummarizationCost>>): ColumnDef<typeof billingTableFeatures, SummarizationCost, any>[] {
  return [
    helper.accessor('workspaceName', {
      header: 'Project Name',
      cell: (c) => (
        <Link
          to={`/projects/${c.row.original.region.toLowerCase()}/${c.row.original.workspaceId}`}
          className="font-semibold text-link underline-offset-2 hover:underline"
        >
          {c.getValue()}
        </Link>
      ),
    }),
    helper.accessor('workspaceId', {
      header: 'Workspace ID',
      cell: (c) => <span className="font-mono text-[12.5px]">{c.getValue()}</span>,
    }),
    helper.accessor('year', { header: 'Year' }),
    helper.accessor('month', {
      header: 'Month',
      cell: (c) => MONTHS[c.getValue() - 1] ?? c.getValue(),
    }),
    helper.accessor('count', {
      header: 'Doc Count',
      meta: { align: 'right' },
      cell: (c) => <span className="num">{count(c.getValue())}</span>,
    }),
    helper.accessor('totalInputTokenCount', {
      header: 'Input Tokens',
      meta: { align: 'right' },
      cell: (c) => <span className="num">{count(c.getValue())}</span>,
    }),
    helper.accessor('totalOutputTokenCount', {
      header: 'Output Tokens',
      meta: { align: 'right' },
      cell: (c) => <span className="num">{count(c.getValue())}</span>,
    }),
    helper.accessor('totalCost', {
      header: 'Total Cost',
      meta: { align: 'right' },
      cell: (c) => <span className="num font-semibold">{money(c.getValue())}</span>,
    }),
  ]
}

export function AzureCost() {
  const [region, setRegion] = useState<Region>('global')
  const [year, setYear] = useState<YearFilter>(AVAILABLE_YEARS[0])

  const llm = useAsync(() => getLlmChatCosts(region, year), [region, year])
  const summarization = useAsync(() => getSummarizationCosts(region, year), [region, year])
  const imageCaption = useAsync(() => getImageCaptionCosts(region, year), [region, year])

  const anyLoading = llm.loading || summarization.loading || imageCaption.loading
  const anyError = llm.error ?? summarization.error ?? imageCaption.error

  // Summarization is billed as two distinct apps under one table (SummarizationJobBilling),
  // distinguished by `appName` — split apart here so each gets its own bar/table rather
  // than being lumped into one generic "Summarization" figure.
  const mineSummarizationRows = useMemo(
    () => (summarization.data ?? []).filter((r) => r.appName === 'Mine_Summarization'),
    [summarization.data],
  )
  const privLogRows = useMemo(
    () => (summarization.data ?? []).filter((r) => r.appName === 'PrivLog'),
    [summarization.data],
  )

  const categoryTotals = useMemo(
    () => [
      { label: 'Vero (LLM Chat)', value: sum(llm.data, (r) => r.totalCost) },
      { label: 'Mine_Summarization', value: sum(mineSummarizationRows, (r) => r.totalCost) },
      { label: appLabel('PrivLog'), value: sum(privLogRows, (r) => r.totalCost) },
      { label: 'Image Caption', value: sum(imageCaption.data, (r) => r.totalCost) },
    ],
    [llm.data, mineSummarizationRows, privLogRows, imageCaption.data],
  )

  // One combined AI-cost figure per workspace, across all three categories — there is
  // no server-computed "total AI cost" anywhere, so this is summed client-side from the
  // three raw lists, keyed by region+workspaceId since the same numeric workspace ID
  // could in principle exist in both regions.
  const topWorkspaces = useMemo(() => {
    const map = new Map<string, { workspaceName: string; total: number }>()
    const add = (rows: { region: string; workspaceId: number; workspaceName: string; totalCost: number }[]) => {
      for (const r of rows) {
        const key = `${r.region}-${r.workspaceId}`
        const existing = map.get(key)
        if (existing) existing.total += r.totalCost
        else map.set(key, { workspaceName: r.workspaceName, total: r.totalCost })
      }
    }
    add(llm.data ?? [])
    add(summarization.data ?? [])
    add(imageCaption.data ?? [])
    return [...map.values()]
      .filter((w) => w.total > 0)
      .sort((a, b) => b.total - a.total)
      .slice(0, 10)
      .map((w) => ({ label: w.workspaceName, value: w.total }))
  }, [llm.data, summarization.data, imageCaption.data])

  // Monthly breakdowns only make sense for one specific year — same reasoning as the
  // rest of this app's year-scoped monthly charts (RevenueTrend, AppSmallMultiples):
  // "All time" has no single 12-month cycle to bucket into.
  const showMonthlyTrends = year !== 'all'

  const costTrendSeries = useMemo(
    () =>
      !showMonthlyTrends
        ? []
        : [
            {
              label: 'Vero (LLM Chat)',
              values: monthlyTotals(llm.data ?? [], (r) => r.month, (r) => r.totalCost),
              total: sum(llm.data, (r) => r.totalCost),
            },
            {
              label: 'Mine_Summarization',
              values: monthlyTotals(mineSummarizationRows, (r) => r.month, (r) => r.totalCost),
              total: sum(mineSummarizationRows, (r) => r.totalCost),
            },
            {
              label: appLabel('PrivLog'),
              values: monthlyTotals(privLogRows, (r) => r.month, (r) => r.totalCost),
              total: sum(privLogRows, (r) => r.totalCost),
            },
            {
              label: 'Image Caption',
              values: monthlyTotals(imageCaption.data ?? [], (r) => r.month, (r) => r.totalCost),
              total: sum(imageCaption.data, (r) => r.totalCost),
            },
          ],
    [showMonthlyTrends, llm.data, mineSummarizationRows, privLogRows, imageCaption.data],
  )

  const tokenTrendSeries = useMemo(
    () =>
      !showMonthlyTrends
        ? []
        : [
            {
              label: 'Input Tokens',
              values: addArrays(
                monthlyTotals(llm.data ?? [], (r) => r.month, (r) => r.inputTokenCount),
                monthlyTotals(summarization.data ?? [], (r) => r.month, (r) => r.totalInputTokenCount),
              ),
              total:
                sum(llm.data, (r) => r.inputTokenCount) + sum(summarization.data, (r) => r.totalInputTokenCount),
            },
            {
              label: 'Output Tokens',
              values: addArrays(
                monthlyTotals(llm.data ?? [], (r) => r.month, (r) => r.outputTokenCount),
                monthlyTotals(summarization.data ?? [], (r) => r.month, (r) => r.totalOutputTokenCount),
              ),
              total:
                sum(llm.data, (r) => r.outputTokenCount) + sum(summarization.data, (r) => r.totalOutputTokenCount),
            },
          ],
    [showMonthlyTrends, llm.data, summarization.data],
  )

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-[31px] leading-[38px] text-primary">Azure Cost</h1>
          <p className="mt-1 text-[15px] leading-6 text-secondary">
            Azure/OpenAI compute spend for Vero, Summarization, and Image Caption — internal
            cost, not client billing.
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
              onChange={(e) => setYear(e.target.value === 'all' ? 'all' : Number(e.target.value))}
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

      {anyError ? (
        <Card>
          <ErrorBlock message={anyError} onRetry={() => { llm.reload(); summarization.reload(); imageCaption.reload() }} />
        </Card>
      ) : anyLoading ? (
        <Card>
          <LoadingBlock label="Loading Azure cost data" rows={6} />
        </Card>
      ) : (
        <>
          <div className="grid items-start gap-5 xl:grid-cols-2">
            <RankedBar
              title="Cost by Application"
              description="Total Azure/OpenAI spend per application for the selected period."
              items={categoryTotals}
              format={money}
              valueColumn="Cost"
              height={260}
            />
            <RankedBar
              title="Top Projects by AI Cost"
              description="The ten highest-spending workspaces, combined across all three cost categories."
              items={topWorkspaces}
              format={money}
              valueColumn="AI Cost"
              height={380}
            />
          </div>

          {showMonthlyTrends && (
            <div className="grid items-start gap-5 xl:grid-cols-2">
              <MiniMultiples
                title="Monthly Cost Trend by Application"
                description={`Monthly Azure/OpenAI spend by application in ${year}.`}
                series={costTrendSeries}
                format={money}
                emptyMessage="No Azure cost activity recorded for this year."
              />
              <MiniMultiples
                title="Monthly Token Usage Trend"
                description={`Input vs. output tokens across Vero and Summarization in ${year}.`}
                series={tokenTrendSeries}
                format={compact}
                emptyMessage="No token usage recorded for this year."
              />
            </div>
          )}

          <CostTableSection<LlmChatCost>
            title="Vero Cost"
            description="Blob storage, index, and conversation cost per workspace, by month."
            data={llm.data}
            searchPlaceholder="Project or workspace ID"
            matchesSearch={(r, q) =>
              r.workspaceName.toLowerCase().includes(q) || String(r.workspaceId).includes(q)
            }
            defaultSort={[{ id: 'totalCost', desc: true }]}
            buildColumns={(helper) => [
              helper.accessor('workspaceName', {
                header: 'Project Name',
                cell: (c) => (
                  <Link
                    to={`/projects/${c.row.original.region.toLowerCase()}/${c.row.original.workspaceId}`}
                    className="font-semibold text-link underline-offset-2 hover:underline"
                  >
                    {c.getValue()}
                  </Link>
                ),
              }),
              helper.accessor('workspaceId', {
                header: 'Workspace ID',
                cell: (c) => <span className="font-mono text-[12.5px]">{c.getValue()}</span>,
              }),
              helper.accessor('year', { header: 'Year' }),
              helper.accessor('month', {
                header: 'Month',
                cell: (c) => MONTHS[c.getValue() - 1] ?? c.getValue(),
              }),
              helper.accessor('blobStorageCost', {
                header: 'Blob Storage Cost',
                meta: { align: 'right' },
                cell: (c) => <span className="num">{money(c.getValue())}</span>,
              }),
              helper.accessor('indexCost', {
                header: 'Index Cost',
                meta: { align: 'right' },
                cell: (c) => <span className="num">{money(c.getValue())}</span>,
              }),
              helper.accessor('conversationCost', {
                header: 'Conversation Cost',
                meta: { align: 'right' },
                cell: (c) => <span className="num">{money(c.getValue())}</span>,
              }),
              helper.accessor('documentCount', {
                header: 'Doc Count',
                meta: { align: 'right' },
                cell: (c) => <span className="num">{count(c.getValue())}</span>,
              }),
              helper.accessor('inputTokenCount', {
                header: 'Input Tokens',
                meta: { align: 'right' },
                cell: (c) => <span className="num">{count(c.getValue())}</span>,
              }),
              helper.accessor('outputTokenCount', {
                header: 'Output Tokens',
                meta: { align: 'right' },
                cell: (c) => <span className="num">{count(c.getValue())}</span>,
              }),
              helper.accessor('totalCost', {
                header: 'Total Cost',
                meta: { align: 'right' },
                cell: (c) => <span className="num font-semibold">{money(c.getValue())}</span>,
              }),
            ]}
          />

          <CostTableSection<SummarizationCost>
            title="Mine_Summarization Cost"
            description="Per-workspace Mine_Summarization cost, by month."
            data={mineSummarizationRows}
            searchPlaceholder="Project or workspace ID"
            matchesSearch={(r, q) =>
              r.workspaceName.toLowerCase().includes(q) || String(r.workspaceId).includes(q)
            }
            defaultSort={[{ id: 'totalCost', desc: true }]}
            buildColumns={summarizationColumns}
          />

          <CostTableSection<SummarizationCost>
            title={`${appLabel('PrivLog')} Cost`}
            description={`Per-workspace ${appLabel('PrivLog')} cost, by month.`}
            data={privLogRows}
            searchPlaceholder="Project or workspace ID"
            matchesSearch={(r, q) =>
              r.workspaceName.toLowerCase().includes(q) || String(r.workspaceId).includes(q)
            }
            defaultSort={[{ id: 'totalCost', desc: true }]}
            buildColumns={summarizationColumns}
          />

          <CostTableSection<ImageCaptionCost>
            title="Image Caption Cost"
            description="Per-workspace image captioning cost, by month."
            data={imageCaption.data}
            searchPlaceholder="Project or workspace ID"
            matchesSearch={(r, q) =>
              r.workspaceName.toLowerCase().includes(q) || String(r.workspaceId).includes(q)
            }
            defaultSort={[{ id: 'totalCost', desc: true }]}
            buildColumns={(helper) => [
              helper.accessor('workspaceName', {
                header: 'Project Name',
                cell: (c) => (
                  <Link
                    to={`/projects/${c.row.original.region.toLowerCase()}/${c.row.original.workspaceId}`}
                    className="font-semibold text-link underline-offset-2 hover:underline"
                  >
                    {c.getValue()}
                  </Link>
                ),
              }),
              helper.accessor('workspaceId', {
                header: 'Workspace ID',
                cell: (c) => <span className="font-mono text-[12.5px]">{c.getValue()}</span>,
              }),
              helper.accessor('year', { header: 'Year' }),
              helper.accessor('month', {
                header: 'Month',
                cell: (c) => MONTHS[c.getValue() - 1] ?? c.getValue(),
              }),
              helper.accessor('imageCount', {
                header: 'Image Count',
                meta: { align: 'right' },
                cell: (c) => <span className="num">{count(c.getValue())}</span>,
              }),
              helper.accessor('totalCost', {
                header: 'Total Cost',
                meta: { align: 'right' },
                cell: (c) => <span className="num font-semibold">{money(c.getValue())}</span>,
              }),
            ]}
          />
        </>
      )}
    </div>
  )
}

/**
 * One mini bar chart per category, twelve months each — the same small-multiples
 * pattern as AppSmallMultiples (components/charts/AppSmallMultiples.tsx), but generic
 * over the value's unit (money here, token counts for the usage trend) rather than
 * fixed to document counts. Kept local to this page rather than folded into the
 * shared component: that one's copy is written specifically for document volume
 * ("N documents", "No documents were processed"), and generalizing it would mean
 * touching ProjectDetail's chart to thread a format/unit prop it has no use for.
 */
function MiniMultiples({
  title,
  description,
  series,
  format,
  emptyMessage,
}: {
  title: string
  description: string
  series: { label: string; values: number[]; total: number }[]
  format: (n: number) => string
  emptyMessage: string
}) {
  const active = series.filter((s) => s.total > 0)
  const peak = Math.max(1, ...active.flatMap((s) => s.values))

  return (
    <ChartFrame
      title={title}
      description={description}
      tableLabel={title}
      table={{
        columns: ['Application', ...MONTHS, 'Total'],
        rows: series.map((s) => [s.label, ...s.values.map((v) => format(v)), format(s.total)]),
      }}
    >
      {active.length === 0 ? (
        <p className="py-8 text-center text-[14px] text-secondary">{emptyMessage}</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {active.map((s) => (
            <figure key={s.label} className="min-w-0 rounded-[8px] border border-default p-3">
              <figcaption className="mb-1.5 flex items-baseline justify-between gap-2">
                <span className="truncate text-[13px] font-semibold text-primary">{s.label}</span>
                <span className="shrink-0 font-mono text-[12px] text-secondary">{format(s.total)}</span>
              </figcaption>
              <div
                className="flex items-end gap-[3px]"
                role="img"
                aria-label={`${s.label}: ${s.values.map((v, i) => `${MONTHS[i]} ${format(v)}`).join(', ')}`}
              >
                {s.values.map((v, i) => (
                  <div key={i} className="group relative flex flex-1 flex-col items-center" title={`${MONTHS[i]}: ${format(v)}`}>
                    <div className="flex h-16 w-full items-end">
                      <div
                        className="w-full rounded-t-[2px] transition-[height]"
                        style={{ height: `${Math.max(v > 0 ? 2 : 0, (v / peak) * 64)}px`, background: CHART.primary }}
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

/**
 * One sortable, searchable, paginated table section — the exact TanStack Table
 * wiring Projects.tsx uses inline, factored out here because this page needs it
 * three times over (Vero / Summarization / Image Caption cost), each with its own
 * row type and column set. Not promoted to components/table/: nothing outside this
 * page needs it yet, and Projects.tsx's own table has enough extra behavior (a
 * pinned Total row, an export button, a monthly-detail toggle) that unifying the two
 * would add parameters neither call site actually wants.
 */
function CostTableSection<T extends { workspaceId: number }>({
  title,
  description,
  data,
  searchPlaceholder,
  matchesSearch,
  defaultSort,
  buildColumns,
}: {
  title: string
  description: string
  data: T[] | null
  searchPlaceholder: string
  matchesSearch: (row: T, query: string) => boolean
  defaultSort: SortingState
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  buildColumns: (helper: ReturnType<typeof createColumnHelper<typeof billingTableFeatures, T>>) => ColumnDef<typeof billingTableFeatures, T, any>[]
}) {
  const [search, setSearch] = useState('')
  const [sorting, setSorting] = useState<SortingState>(defaultSort)
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 10 })

  const helper = useMemo(() => createColumnHelper<typeof billingTableFeatures, T>(), [])
  const columns = useMemo(() => buildColumns(helper), [helper, buildColumns])

  const table = useTable({
    features: billingTableFeatures,
    data: data ?? [],
    columns,
    state: { sorting, globalFilter: search, pagination },
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    globalFilterFn: (row, _id, filter) => matchesSearch(row.original, String(filter).toLowerCase()),
    autoResetPageIndex: true,
  })

  const rows = table.getPaginatedRowModel().rows
  const filteredCount = table.getFilteredRowModel().rows.length
  const totalCount = data?.length ?? 0

  return (
    <Card>
      <CardHeader title={title} description={description} />
      <div className="flex flex-wrap items-center gap-3 border-b border-divider px-5 py-3">
        <PageSize value={pagination.pageSize} onChange={(pageSize) => setPagination({ pageIndex: 0, pageSize })} />
        <label className="ml-auto flex items-center gap-2 text-[13px] text-secondary">
          Search:
          <span className="relative">
            <Search
              className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted"
              aria-hidden="true"
            />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={searchPlaceholder}
              className="h-8 w-56 rounded-[6px] border border-default bg-surface pl-7 pr-2 text-[13px] text-primary placeholder:text-muted"
            />
          </span>
        </label>
      </div>

      {totalCount === 0 ? (
        <EmptyBlock title="No data" description="No cost activity recorded for this period." />
      ) : filteredCount === 0 ? (
        <EmptyBlock
          title="No rows match that search"
          description={`Nothing matches "${search}". Clear the search or try a workspace ID.`}
        />
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[13px]">
              <thead>
                <tr className="border-b border-default">
                  {table.getHeaderGroups()[0].headers.map((header) => {
                    const meta = header.column.columnDef.meta as ColumnMeta | undefined
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
                          'whitespace-nowrap bg-surface px-3 py-2.5 text-left font-semibold text-secondary',
                          meta?.align === 'right' && 'text-right',
                        )}
                      >
                        {header.column.getCanSort() ? (
                          <button
                            type="button"
                            onClick={header.column.getToggleSortingHandler()}
                            className={cn(
                              'inline-flex items-center gap-1 hover:text-action',
                              meta?.align === 'right' && 'flex-row-reverse',
                            )}
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
                  <tr key={row.id} className="border-b border-divider last:border-0 hover:bg-action-wash">
                    {row.getVisibleCells().map((cell) => {
                      const meta = cell.column.columnDef.meta as ColumnMeta | undefined
                      return (
                        <td
                          key={cell.id}
                          className={cn(
                            'whitespace-nowrap px-3 py-2 text-primary',
                            meta?.align === 'right' && 'text-right',
                          )}
                        >
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination table={table} total={filteredCount} />
        </>
      )}
    </Card>
  )
}
