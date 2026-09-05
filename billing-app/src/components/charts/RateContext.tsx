import { rate } from '@/lib/format'
import { ChartFrame } from './ChartFrame'

/**
 * Where this project's rate sits in the portfolio.
 *
 * A single number ($0.042/doc) means nothing on its own. Against the
 * distribution it answers the question a PM actually has: is this priced
 * normally? Table-only by request — the strip-plot visualization this used to
 * draw is gone, not just hidden.
 */
export function RateContext({
  projectRate,
  distribution,
}: {
  projectRate: number
  distribution: number[]
}) {
  if (distribution.length === 0) {
    return null
  }

  const min = Math.min(...distribution, projectRate)
  const max = Math.max(...distribution, projectRate)

  const sorted = [...distribution].sort((a, b) => a - b)
  const median = sorted[Math.floor(sorted.length / 2)]
  const below = sorted.filter((r) => r < projectRate).length
  const percentile = Math.round((below / sorted.length) * 100)

  return (
    <ChartFrame
      title="Rate in Portfolio Context"
      description={`${rate(projectRate)} per document — higher than ${percentile}% of billable projects.`}
      tableLabel="This project's rate against the portfolio distribution"
      tableOnly
      table={{
        columns: ['Measure', 'Rate'],
        rows: [
          ['This project', rate(projectRate)],
          ['Portfolio median', rate(median)],
          ['Portfolio lowest', rate(min)],
          ['Portfolio highest', rate(max)],
          ['Billable projects', String(sorted.length)],
        ],
      }}
    />
  )
}
