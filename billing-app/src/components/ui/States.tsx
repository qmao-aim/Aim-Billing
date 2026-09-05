import type { ReactNode } from 'react'
import { AlertTriangle, Inbox } from 'lucide-react'
import { Button } from './Button'
import { cn } from '@/lib/utils'

/* Loading, empty, and error states.
 *
 * The application this replaces had none of the three: a failed AJAX call was
 * logged to the console and left the table blank, so "the request failed" and
 * "there is no data" looked identical to the user. */

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn('animate-pulse rounded-[6px] bg-surface-muted', className)}
      aria-hidden="true"
    />
  )
}

export function LoadingBlock({ label, rows = 5 }: { label: string; rows?: number }) {
  return (
    <div role="status" aria-live="polite" className="space-y-3 p-6">
      <span className="sr-only">{label}</span>
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-6 w-full" />
      ))}
    </div>
  )
}

export function ErrorBlock({
  message,
  onRetry,
}: {
  message: string
  onRetry?: () => void
}) {
  return (
    <div role="alert" className="flex flex-col items-center gap-3 px-6 py-12 text-center">
      <AlertTriangle className="size-6 text-danger" aria-hidden="true" />
      <div>
        <p className="text-[16px] font-semibold text-primary">This data could not be loaded</p>
        <p className="mx-auto mt-1 max-w-md text-[14px] leading-5 text-secondary">{message}</p>
      </div>
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          Try Again
        </Button>
      )}
    </div>
  )
}

export function EmptyBlock({
  title,
  description,
  action,
}: {
  title: string
  description: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
      <Inbox className="size-6 text-muted" aria-hidden="true" />
      <div>
        <p className="text-[16px] font-semibold text-primary">{title}</p>
        <p className="mx-auto mt-1 max-w-md text-[14px] leading-5 text-secondary">{description}</p>
      </div>
      {action}
    </div>
  )
}
