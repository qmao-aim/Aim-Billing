/* Display formatting.
 *
 * The existing application renders amounts as whole dollars with thousands
 * separators and rates to three decimals; both conventions are preserved so
 * numbers here reconcile against numbers there.
 */

const wholeDollars = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
})

const centsDollars = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const counts = new Intl.NumberFormat('en-US')

export const money = (n: number) => wholeDollars.format(n)
export const moneyExact = (n: number) => centsDollars.format(n)
export const count = (n: number) => counts.format(n)

/** Unit rates carry three decimals — $0.030 reads differently from $0.03. */
export const rate = (n: number) => `$${n.toFixed(3)}`

export const percent = (n: number) =>
  `${n > 0 ? '+' : ''}${n.toFixed(1)}%`

/** Compact axis labels: 1.2M, 340K. Charts only, never tables. */
export function compact(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (Math.abs(n) >= 1_000) return `${Math.round(n / 1_000)}K`
  return String(n)
}

export function compactMoney(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (Math.abs(n) >= 1_000) return `$${Math.round(n / 1_000)}K`
  return `$${Math.round(n)}`
}

/** A dash reads as "no data"; a zero reads as "we measured zero". */
export const orDash = (n: number | null | undefined, fmt: (v: number) => string) =>
  n === null || n === undefined || n === 0 ? '—' : fmt(n)

export function dateTime(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

export function dateOnly(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
