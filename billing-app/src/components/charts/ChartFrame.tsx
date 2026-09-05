import { useState, type ReactNode } from 'react'
import { Table2, BarChart3 } from 'lucide-react'
import { cn } from '@/lib/utils'

/* Every chart ships with a table view.
 *
 * This is the accessible alternative required by the visualization rules, and
 * it doubles as the answer to "what is that number exactly?" — which a chart
 * can only ever approximate. The toggle is part of the frame so no chart can
 * be added without one. */

export interface TableView {
  columns: string[]
  rows: (string | number)[][]
}

export function ChartFrame({
  title,
  description,
  table,
  tableLabel,
  children,
  className,
  action,
  tableOnly = false,
}: {
  title: string
  description?: string
  table: TableView
  tableLabel: string
  children?: ReactNode
  className?: string
  action?: ReactNode
  /** No chart to show, or the chart's been deliberately dropped — skips the
   *  chart/table toggle entirely and always renders the table. */
  tableOnly?: boolean
}) {
  const [view, setView] = useState<'chart' | 'table'>(tableOnly ? 'table' : 'chart')
  const effectiveView = tableOnly ? 'table' : view

  return (
    <section
      className={cn('rounded-[10px] border border-default bg-surface shadow-e1', className)}
      aria-label={title}
    >
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-divider px-5 py-4">
        <div className="min-w-0">
          <h3 className="font-display text-[16px] leading-6 text-primary">{title}</h3>
          {description && (
            <p className="mt-0.5 text-[13px] leading-5 text-secondary">{description}</p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {action}
          {!tableOnly && (
            <div className="flex items-center rounded-[6px] border border-default p-0.5" role="group" aria-label="View as">
              <button
                type="button"
                onClick={() => setView('chart')}
                aria-pressed={view === 'chart'}
                title="Chart view"
                className={cn(
                  'rounded-[4px] p-1.5 transition-colors duration-[120ms]',
                  view === 'chart' ? 'bg-action text-on-action' : 'text-secondary hover:bg-action-wash',
                )}
              >
                <BarChart3 className="size-4" aria-hidden="true" />
                <span className="sr-only">Chart view</span>
              </button>
              <button
                type="button"
                onClick={() => setView('table')}
                aria-pressed={view === 'table'}
                title="Table view"
                className={cn(
                  'rounded-[4px] p-1.5 transition-colors duration-[120ms]',
                  view === 'table' ? 'bg-action text-on-action' : 'text-secondary hover:bg-action-wash',
                )}
              >
                <Table2 className="size-4" aria-hidden="true" />
                <span className="sr-only">Table view</span>
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="p-5">
        {effectiveView === 'chart' ? (
          children
        ) : (
          <div className="max-h-[320px] overflow-auto">
            <table className="w-full text-[13px]">
              <caption className="sr-only">{tableLabel}</caption>
              <thead className="sticky top-0 bg-surface">
                <tr className="border-b border-default text-left">
                  {table.columns.map((c, i) => (
                    <th
                      key={c}
                      scope="col"
                      className={cn(
                        'py-2 pr-4 font-semibold text-secondary',
                        i > 0 && 'text-right',
                      )}
                    >
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {table.rows.map((row, ri) => (
                  <tr key={ri} className="border-b border-divider last:border-0">
                    {row.map((cell, ci) => (
                      <td
                        key={ci}
                        className={cn(
                          'py-1.5 pr-4 text-primary',
                          ci > 0 && 'text-right num font-mono text-[12.5px]',
                        )}
                      >
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  )
}

/** Shared tooltip shell so hover styling is identical across chart types. */
export function TooltipCard({ label, rows }: { label: string; rows: { name: string; value: string; color?: string }[] }) {
  return (
    <div className="rounded-[6px] border border-default bg-surface px-3 py-2 shadow-e2">
      <p className="text-[12.5px] font-semibold text-primary">{label}</p>
      <div className="mt-1 space-y-0.5">
        {rows.map((r) => (
          <div key={r.name} className="flex items-center gap-2 text-[12.5px]">
            {r.color && (
              <span
                className="size-2 shrink-0 rounded-[2px]"
                style={{ background: r.color }}
                aria-hidden="true"
              />
            )}
            <span className="text-secondary">{r.name}</span>
            <span className="ml-auto font-mono text-primary">{r.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
