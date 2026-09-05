import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { CHART, axisProps } from './palette'
import { ChartFrame, TooltipCard } from './ChartFrame'

export interface RankedItem {
  label: string
  value: number
  /** Optional second measure shown only in the tooltip and table. */
  secondary?: { name: string; formatted: string }
}

/**
 * Single-series horizontal bars, sorted descending.
 *
 * One measure per chart. Where documents and dollars both matter they are two
 * of these side by side sharing a category order — never one chart with two
 * y-scales, which would make the relationship between the two look like
 * whatever the axis ranges happened to imply.
 */
export function RankedBar({
  title,
  description,
  items,
  format,
  valueColumn,
  highlightLabel,
  height = 300,
}: {
  title: string
  description?: string
  items: RankedItem[]
  format: (n: number) => string
  valueColumn: string
  /** Draws one bar in a distinct state — used for "this project". */
  highlightLabel?: string
  height?: number
}) {
  const sorted = [...items].sort((a, b) => b.value - a.value)
  const columns = [title.includes('Project') ? 'Project' : 'Application', valueColumn]
  if (sorted[0]?.secondary) columns.push(sorted[0].secondary.name)

  return (
    <ChartFrame
      title={title}
      description={description}
      tableLabel={`${title} as a table`}
      table={{
        columns,
        rows: sorted.map((i) =>
          i.secondary
            ? [i.label, format(i.value), i.secondary.formatted]
            : [i.label, format(i.value)],
        ),
      }}
    >
      <ResponsiveContainer width="100%" height={height}>
        <BarChart
          data={sorted}
          layout="vertical"
          margin={{ top: 0, right: 56, bottom: 0, left: 4 }}
          barCategoryGap={6}
        >
          <CartesianGrid stroke={CHART.grid} horizontal={false} />
          <XAxis type="number" hide />
          {/* Recharts clips overflowing category labels from the LEFT, which
              turns "Ashford_Pharma_Antitrust" into "hford_Pharma_Antitrust" —
              unreadable, and worse than an obvious truncation. Cut from the
              right with an ellipsis instead; the full name is in the tooltip
              and the table view. */}
          <YAxis
            type="category"
            dataKey="label"
            {...axisProps}
            axisLine={false}
            width={168}
            interval={0}
            tickFormatter={(value: string) =>
              value.length > 22 ? `${value.slice(0, 21)}…` : value
            }
          />
          <Tooltip
            cursor={{ fill: 'rgba(72,103,132,0.06)' }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null
              const item = payload[0].payload as RankedItem
              return (
                <TooltipCard
                  label={item.label}
                  rows={[
                    { name: valueColumn, value: format(item.value), color: CHART.primary },
                    ...(item.secondary
                      ? [{ name: item.secondary.name, value: item.secondary.formatted }]
                      : []),
                  ]}
                />
              )
            }}
          />
          <Bar
            dataKey="value"
            radius={[0, 4, 4, 0]}
            isAnimationActive={false}
            label={{
              position: 'right',
              fill: CHART.axisText,
              fontSize: 12,
              formatter: (v) => (typeof v === 'number' ? format(v) : String(v ?? '')),
            }}
          >
            {sorted.map((item) => (
              <Cell
                key={item.label}
                fill={item.label === highlightLabel ? CHART.primary : CHART.primary}
                fillOpacity={highlightLabel && item.label !== highlightLabel ? 0.38 : 1}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartFrame>
  )
}
