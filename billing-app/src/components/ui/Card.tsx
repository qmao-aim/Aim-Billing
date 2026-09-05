import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/** White surface, 10px radius, hairline border, shadow-1. A "panel" is a card
 *  with a titled header. */
export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div
      className={cn(
        'rounded-[10px] border border-default bg-surface shadow-e1',
        className,
      )}
    >
      {children}
    </div>
  )
}

export function CardHeader({
  title,
  description,
  actions,
  className,
}: {
  title: string
  description?: string
  actions?: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex flex-wrap items-start justify-between gap-3 border-b border-divider px-6 py-4',
        className,
      )}
    >
      <div className="min-w-0">
        <h2 className="font-display text-[20px] leading-7 text-primary">{title}</h2>
        {description && (
          <p className="mt-1 text-[14px] leading-5 text-secondary">{description}</p>
        )}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  )
}

export function CardBody({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn('p-6', className)}>{children}</div>
}
