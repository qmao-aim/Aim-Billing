import type { ReactTable, RowData } from '@tanstack/react-table'
import { ChevronDown, ChevronUp, ChevronsUpDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { BillingTableFeatures } from './features'

/* Table furniture deliberately kept close to the DataTables vocabulary the
 * current application uses — "Show N entries", "Search:", "Showing X to Y of
 * Z entries", Previous/N/Next — because the people using this read that
 * furniture fluently already. The styling is new; the grammar is not.
 *
 * Sortable headers are real buttons carrying aria-sort, which the current
 * implementation lacks entirely. */

export function SortIcon({ dir }: { dir: false | 'asc' | 'desc' }) {
  const Icon = dir === 'asc' ? ChevronUp : dir === 'desc' ? ChevronDown : ChevronsUpDown
  return (
    <Icon
      className={cn('size-3.5 shrink-0', dir ? 'text-action' : 'text-muted')}
      aria-hidden="true"
    />
  )
}

export function PageSize({
  value,
  onChange,
}: {
  value: number
  onChange: (n: number) => void
}) {
  return (
    <label className="flex items-center gap-2 text-[13px] text-secondary">
      Show
      <select
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-8 rounded-[6px] border border-default bg-surface px-2 text-[13px] text-primary"
        aria-label="Rows per page"
      >
        {[10, 25, 50, 100].map((n) => (
          <option key={n} value={n}>
            {n}
          </option>
        ))}
      </select>
      entries
    </label>
  )
}

export function Pagination<T extends RowData>({
  table,
  total,
}: {
  table: ReactTable<BillingTableFeatures, T>
  total: number
}) {
  const { pageIndex, pageSize } = table.state.pagination
  const pageCount = table.getPageCount()
  const first = total === 0 ? 0 : pageIndex * pageSize + 1
  const last = Math.min(total, (pageIndex + 1) * pageSize)

  // Window the page buttons so 40 pages don't produce 40 controls.
  const pages: number[] = []
  const from = Math.max(0, Math.min(pageIndex - 2, pageCount - 5))
  for (let i = from; i < Math.min(pageCount, from + 5); i++) pages.push(i)

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-divider px-5 py-3">
      <p className="text-[13px] text-secondary" aria-live="polite">
        Showing {first.toLocaleString()} to {last.toLocaleString()} of {total.toLocaleString()}{' '}
        entries
      </p>
      <nav className="flex items-center gap-1" aria-label="Pagination">
        <button
          type="button"
          onClick={() => table.previousPage()}
          disabled={!table.getCanPreviousPage()}
          className="rounded-[6px] px-3 py-1.5 text-[13px] font-semibold text-action disabled:cursor-not-allowed disabled:text-muted hover:bg-action-wash disabled:hover:bg-transparent"
        >
          Previous
        </button>
        {pages.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => table.setPageIndex(p)}
            aria-current={p === pageIndex ? 'page' : undefined}
            className={cn(
              'min-w-8 rounded-[6px] px-2.5 py-1.5 text-[13px] font-semibold',
              p === pageIndex
                ? 'bg-action text-on-action'
                : 'text-action hover:bg-action-wash',
            )}
          >
            {p + 1}
          </button>
        ))}
        <button
          type="button"
          onClick={() => table.nextPage()}
          disabled={!table.getCanNextPage()}
          className="rounded-[6px] px-3 py-1.5 text-[13px] font-semibold text-action disabled:cursor-not-allowed disabled:text-muted hover:bg-action-wash disabled:hover:bg-transparent"
        >
          Next
        </button>
      </nav>
    </div>
  )
}

export function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T
  options: { value: T; label: string }[]
  onChange: (v: T) => void
  label: string
}) {
  return (
    <div
      className="flex items-center rounded-[6px] border border-default bg-surface p-0.5"
      role="group"
      aria-label={label}
    >
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          aria-pressed={value === o.value}
          className={cn(
            'rounded-[4px] px-3 py-1.5 text-[13px] font-semibold transition-colors duration-[120ms]',
            value === o.value
              ? 'bg-action text-on-action'
              : 'text-secondary hover:bg-action-wash hover:text-action',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
