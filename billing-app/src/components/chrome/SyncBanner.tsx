import { useState } from 'react'
import { AlertTriangle, X } from 'lucide-react'
import { getConnectionStatus } from '@/api/client'
import { useAsync } from '@/lib/useAsync'
import { dateTime } from '@/lib/format'

/**
 * Billing sync health.
 *
 * The current application raises this as a blocking `bootbox.confirm` modal on
 * page load, which interrupts the user before they can read anything. The same
 * information is more useful as a dismissible banner: it does not stop someone
 * reading data that is merely stale, and it stays visible while they do.
 */
export function SyncBanner() {
  const [dismissed, setDismissed] = useState(false)
  // This banner is shared chrome across every page, not scoped to whatever
  // region a specific page's dropdown has selected — 'global' checks both
  // regions and surfaces the worse (older) sync time, so a stale region is
  // never silently hidden behind a fresher one.
  const { data } = useAsync(() => getConnectionStatus('global'), [])

  if (!data || data.online || dismissed) return null

  return (
    <div role="status" className="border-b border-[#F0D9A8] bg-warning-bg">
      <div className="flex w-full items-start gap-3 px-6 py-3">
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
        <p className="flex-1 text-[14px] leading-5 text-primary">
          <span className="font-semibold">The billing connection is currently off.</span>{' '}
          Usage last synced {dateTime(data.lastSyncedOn)}. Figures below may be out of date —
          contact{' '}
          <a
            href="mailto:AnalyticsInstitute@ankura.com"
            className="text-link underline underline-offset-2"
          >
            AnalyticsInstitute@ankura.com
          </a>{' '}
          to restore it.
        </p>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label="Dismiss sync warning"
          className="shrink-0 rounded-[4px] p-1 text-secondary hover:bg-[rgba(0,0,0,0.06)]"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  )
}
