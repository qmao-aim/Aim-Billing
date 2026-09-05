import { MONTHS } from '@/api/types'
import { CHART } from './palette'

/**
 * A project's twelve-month shape, sized for a table cell.
 *
 * This is the column that makes the default table view worth landing on: it
 * shows whether a project is ramping, peaking, or finished without the reader
 * opening twenty-four month columns.
 */
export function Sparkline({
  values,
  label,
  width = 96,
  height = 24,
}: {
  values: number[]
  label: string
  width?: number
  height?: number
}) {
  const peak = Math.max(...values)
  if (peak <= 0) {
    return (
      <span className="text-[12px] text-muted" title={`${label}: no activity`}>
        —
      </span>
    )
  }

  const gap = 2
  const barWidth = (width - gap * (values.length - 1)) / values.length
  const busiest = values.indexOf(peak)

  return (
    <svg
      width={width}
      height={height}
      role="img"
      aria-label={`${label}. Peak in ${MONTHS[busiest]}.`}
      className="block"
    >
      {values.map((v, i) => {
        const h = v > 0 ? Math.max(1.5, (v / peak) * height) : 0
        return (
          <rect
            key={i}
            x={i * (barWidth + gap)}
            y={height - h}
            width={barWidth}
            height={h}
            rx={1}
            fill={CHART.primary}
            /* The peak month is full strength; the rest recede so the shape
               reads at a glance rather than as twelve equal marks. */
            fillOpacity={i === busiest ? 1 : 0.45}
          />
        )
      })}
    </svg>
  )
}
