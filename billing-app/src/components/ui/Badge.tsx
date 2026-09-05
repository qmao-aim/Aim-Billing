import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/* Subtle tint-on-light form, as production's Manage "Created" badge.
 * Status is never conveyed by colour alone — the label always carries it. */
type Tone = 'success' | 'warning' | 'danger' | 'info' | 'neutral'

const tones: Record<Tone, string> = {
  success: 'bg-success-bg text-success',
  warning: 'bg-warning-bg text-warning',
  danger: 'bg-danger-bg text-danger',
  info: 'bg-info-bg text-info',
  neutral: 'bg-surface-muted text-secondary',
}

export function Badge({
  tone = 'neutral',
  children,
  className,
}: {
  tone?: Tone
  children: ReactNode
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-[6px] px-2 py-0.5 text-[12.5px] font-semibold leading-4',
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}
