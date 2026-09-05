import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { PortfolioTotals } from '@/api/types'
import { compactMoney, money } from '@/lib/format'
import { CHART, axisProps, gridProps } from './palette'
import { ChartFrame, TooltipCard } from './ChartFrame'

/**
 * Billed amount over time.
 *
 * The bucket comes from the data, not from this component: twelve months for
 * a single year, one point per year across the whole history. The series
 * carries its own labels so nothing here has to infer which it is.
 *
 * Where a prior period exists it is drawn as a reference rather than a peer —
 * recessive grey, dashed, no markers. That dash is also the secondary
 * encoding keeping the two series apart without relying on hue (palette.ts).
 * Across the whole history there is no earlier period, so the chart drops to
 * a single series and the legend disappears with it.
 */
export function RevenueTrend({ totals }: { totals: PortfolioTotals }) {
  const { series, priorSeries, seriesLabel, priorSeriesLabel, seriesNote } = totals
  const hasPrior = priorSeries !== null && priorSeriesLabel !== null

  const data = series.map((point, i) => ({
    label: point.label,
    current: point.value,
    prior: priorSeries?.[i]?.value ?? 0,
  }))

  /* Trailing buckets with no billing yet would draw the line down to zero and
   * imply revenue collapsed, when in fact the period has not happened. Break
   * the series there instead. */
  const plotted = data.map((d, i) => ({
    ...d,
    current:
      d.current === 0 && series.slice(i).every((p) => p.value === 0) ? null : d.current,
  }))

  return (
    <ChartFrame
      title="Billed Amount Over Time"
      description={[
        hasPrior ? `${seriesLabel} against ${priorSeriesLabel}` : 'Every year on the platform',
        seriesNote,
      ]
        .filter(Boolean)
        .join(' · ')}
      tableLabel="Billed amount over time"
      table={{
        columns: hasPrior
          ? ['Period', seriesLabel, priorSeriesLabel]
          : ['Year', 'Billed'],
        rows: data.map((d) =>
          hasPrior ? [d.label, money(d.current), money(d.prior)] : [d.label, money(d.current)],
        ),
      }}
    >
      {hasPrior && (
        <div className="mb-3 flex items-center gap-4">
          <LegendKey color={CHART.primary} label={seriesLabel} />
          <LegendKey color={CHART.reference} label={priorSeriesLabel} dashed />
        </div>
      )}
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={plotted} margin={{ top: 4, right: 12, bottom: 0, left: 4 }}>
          <CartesianGrid {...gridProps} />
          <XAxis dataKey="label" {...axisProps} axisLine={{ stroke: CHART.grid }} />
          <YAxis
            {...axisProps}
            axisLine={false}
            width={56}
            tickFormatter={(v: number) => compactMoney(v)}
          />
          <Tooltip
            cursor={{ stroke: CHART.axis, strokeWidth: 1 }}
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null
              const current = payload.find((p) => p.dataKey === 'current')?.value as number
              return (
                <TooltipCard
                  label={String(label)}
                  rows={[
                    {
                      name: hasPrior ? seriesLabel : 'Billed',
                      value: money(current ?? 0),
                      color: CHART.primary,
                    },
                    ...(hasPrior
                      ? [
                          {
                            name: priorSeriesLabel,
                            value: money(
                              (payload.find((p) => p.dataKey === 'prior')?.value as number) ?? 0,
                            ),
                            color: CHART.reference,
                          },
                        ]
                      : []),
                  ]}
                />
              )
            }}
          />
          {/* Animation off on both series: Recharts draws lines in by
              animating stroke-dasharray, which overwrites the dash pattern
              that distinguishes the prior-period series from the current one. */}
          {hasPrior && (
            <Line
              type="monotone"
              dataKey="prior"
              stroke={CHART.reference}
              strokeWidth={2}
              strokeDasharray="5 4"
              dot={false}
              activeDot={false}
              isAnimationActive={false}
              name={priorSeriesLabel}
            />
          )}
          <Line
            type="monotone"
            dataKey="current"
            stroke={CHART.primary}
            strokeWidth={2}
            connectNulls={false}
            dot={{ r: 3, fill: CHART.primary, strokeWidth: 0 }}
            activeDot={{ r: 5, fill: CHART.primary, stroke: CHART.surface, strokeWidth: 2 }}
            isAnimationActive={false}
            name={seriesLabel}
          />
        </LineChart>
      </ResponsiveContainer>
    </ChartFrame>
  )
}

export function LegendKey({
  color,
  label,
  dashed = false,
}: {
  color: string
  label: string
  dashed?: boolean
}) {
  return (
    <span className="flex items-center gap-2 text-[12.5px] text-secondary">
      <svg width="18" height="8" aria-hidden="true">
        <line
          x1="0"
          y1="4"
          x2="18"
          y2="4"
          stroke={color}
          strokeWidth="2"
          strokeDasharray={dashed ? '5 4' : undefined}
        />
      </svg>
      {label}
    </span>
  )
}
