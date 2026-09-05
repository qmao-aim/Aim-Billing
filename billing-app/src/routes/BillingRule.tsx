import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Lock, Mail } from 'lucide-react'
import { getBillingRule, saveBillingRule } from '@/api/client'
import { appLabel, RULE_APPS, type BillingRule as Rule, type Region } from '@/api/types'
import { useSession } from '@/lib/session-context'
import { useAsync } from '@/lib/useAsync'
import { dateTime, money, rate } from '@/lib/format'
import { Button } from '@/components/ui/Button'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Checkbox, Field, Input, Label, Radio, Select, Textarea } from '@/components/ui/Field'
import { ConfirmDialog } from '@/components/ui/Dialog'
import { ErrorBlock, LoadingBlock } from '@/components/ui/States'

const TIERS = ['Tier_1', 'Tier_2', 'Tier_3', 'Tier_4', 'Tier_5']
const SUPPORT_EMAIL = 'AnalyticsInstitute@ankura.com'

/** The server stores this as `{"<savedBy email>": "<reason>"}` — a single-entry object,
 *  since the rule (and this reason with it) is only ever written once. */
function parseVeroExceptionReason(raw: string | null): { by: string; reason: string } | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as Record<string, string>
    const [by, reason] = Object.entries(parsed)[0] ?? []
    return by && reason ? { by, reason } : null
  } catch {
    return null
  }
}

export function BillingRule() {
  const { id, region: regionParam } = useParams()
  const workspaceId = Number(id)
  const region = regionParam as Region
  const { environment, email } = useSession()
  const query = useAsync(
    () => getBillingRule(workspaceId, environment, region),
    [workspaceId, environment, region],
  )

  if (query.loading) {
    return (
      <Card>
        <LoadingBlock label="Loading billing rule" rows={6} />
      </Card>
    )
  }
  if (query.error || !query.data) {
    return (
      <Card>
        <ErrorBlock message={query.error ?? 'This project could not be found.'} onRetry={query.reload} />
      </Card>
    )
  }

  return query.data.isDefined === -1 ? (
    <RuleForm rule={query.data} workspaceId={workspaceId} region={region} email={email} />
  ) : (
    <RuleSummary rule={query.data} workspaceId={workspaceId} region={region} />
  )
}

/* ---------------------------------------------------------------------- */
/* Locked state                                                            */
/* ---------------------------------------------------------------------- */

/**
 * A set rule renders as a read-only summary, NOT as a form of disabled
 * inputs. The current application disables every control and leaves the form
 * on screen, which reads as broken rather than as finished, and offers no
 * route forward. Here the rule is presented as a record, with an explicit
 * change-request path.
 */
function RuleSummary({ rule, workspaceId, region }: { rule: Rule; workspaceId: number; region: Region }) {
  const activeApps = RULE_APPS.filter((a) => !(rule.isAppExcluded && rule.jobExcludeList[a]))
  const excludedApps = RULE_APPS.filter((a) => rule.isAppExcluded && rule.jobExcludeList[a])
  // An app can be missing an app_tier row entirely for a given workspace (it's
  // simply never been assigned one) — jobGroupList[a] is then undefined, not a
  // tier name. Filtered out here rather than letting it into the Set, where
  // `.replace()` on an undefined "tier" would throw.
  const usedTiers = [...new Set(
    activeApps.map((a) => rule.jobGroupList[a]).filter((t): t is string => Boolean(t)),
  )].sort()
  const unassignedApps = activeApps.filter((a) => !rule.jobGroupList[a])
  const veroException = parseVeroExceptionReason(rule.veroExceptionReason)

  const mailto = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(
    `Billing rule change request — ${rule.workspaceName} (${workspaceId})`,
  )}&body=${encodeURIComponent(
    `Project: ${rule.workspaceName}\nWorkspace ID: ${workspaceId}\nCurrent rule set by ${rule.createdBy ?? 'unknown'} on ${dateTime(rule.createdOn)}\n\nRequested change:\n\n\nReason:\n\n`,
  )}`

  return (
    <div className="space-y-5">
      <Breadcrumb workspaceId={workspaceId} region={region} />

      <header>
        <h1 className="font-display text-[31px] leading-[38px] text-primary">
          Project Billing Rule
        </h1>
        <p className="mt-1 text-[15px] leading-6 text-secondary">{rule.workspaceName}</p>
      </header>

      <Card>
        <CardHeader
          title="Rule Summary"
          description={`Set by ${rule.createdBy ?? 'unknown'} on ${dateTime(rule.createdOn)}.`}
          actions={
            <span className="flex items-center gap-1.5 rounded-[6px] bg-surface-muted px-2.5 py-1 text-[12.5px] font-semibold text-secondary">
              <Lock className="size-3.5" aria-hidden="true" />
              Locked
            </span>
          }
        />
        <CardBody className="space-y-6">
          <dl className="grid gap-5 sm:grid-cols-2">
            <Row term="Billable">
              {rule.isTest ? (
                <Badge tone="neutral">No — test workspace</Badge>
              ) : (
                <Badge tone="success">Yes</Badge>
              )}
            </Row>
            {!rule.isTest && (
              <Row term="Rate structure">
                {rule.sameUnitPrice ? 'Flat rate for all applications' : 'Tiered by application'}
              </Row>
            )}
          </dl>

          {!rule.isTest && rule.sameUnitPrice && (
            <RateTable
              rows={[
                {
                  name: 'All applications',
                  price: rule.unitPrice,
                  threshold: rule.threshold,
                  apps: activeApps.length,
                },
              ]}
            />
          )}

          {!rule.isTest && !rule.sameUnitPrice && (
            <RateTable
              rows={usedTiers.map((t) => ({
                name: t.replace('_', ' '),
                price: rule.unitPrices[t] ?? 0,
                threshold: rule.thresholdValues[t] ?? 0,
                apps: activeApps.filter((a) => rule.jobGroupList[a] === t).length,
                appNames: activeApps.filter((a) => rule.jobGroupList[a] === t),
              }))}
            />
          )}

          {!rule.isTest && (
            <div>
              <h3 className="text-[14px] font-semibold text-primary">Vero (Chat) billing</h3>
              <p className="mt-1 text-[12.5px] text-secondary">
                Billed separately from the tiers above: each Vero index is charged on creation,
                then again every period below for as long as it&apos;s active.
              </p>
              <dl className="mt-2 grid gap-4 sm:grid-cols-2">
                <Row term="Unit rate">{rate(rule.chatUnitPrice)}</Row>
                <Row term="Billing period">
                  {rule.chatPeriod === 0
                    ? 'Disabled'
                    : `Every ${rule.chatPeriod} month${rule.chatPeriod === 1 ? '' : 's'}`}
                </Row>
              </dl>
              {veroException && (
                <div className="mt-3 rounded-[8px] border border-default bg-surface-muted p-3">
                  <p className="text-[12.5px] font-semibold text-secondary">
                    Vero Billing Exception Reason
                  </p>
                  <p className="mt-1 text-[13px] text-primary">{veroException.reason}</p>
                  <p className="mt-1 text-[12px] text-secondary">— {veroException.by}</p>
                </div>
              )}
            </div>
          )}

          {excludedApps.length > 0 && (
            <div>
              <h3 className="text-[14px] font-semibold text-primary">
                Excluded from billing
              </h3>
              <div className="mt-2 flex flex-wrap gap-2">
                {excludedApps.map((a) => (
                  <Badge key={a} tone="neutral">
                    {appLabel(a)}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {!rule.isTest && !rule.sameUnitPrice && unassignedApps.length > 0 && (
            <div>
              <h3 className="text-[14px] font-semibold text-primary">
                Not assigned a tier
              </h3>
              <p className="mt-1 text-[12.5px] text-secondary">
                No tier assignment exists for these applications on this project — they aren't
                excluded, but they also aren't billed under any of the tiers above.
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {unassignedApps.map((a) => (
                  <Badge key={a} tone="warning">
                    {appLabel(a)}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardBody className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="text-[15px] font-semibold text-primary">Need this rule changed?</h3>
            <p className="mt-1 max-w-xl text-[14px] leading-5 text-secondary">
              Billing rules are set once and cannot be edited here, so that historical invoices
              stay reproducible. The Analytics Institute can amend a rule on request.
            </p>
          </div>
          <a href={mailto}>
            <Button variant="primary">
              <Mail className="size-4" aria-hidden="true" />
              Request a Rule Change
            </Button>
          </a>
        </CardBody>
      </Card>
    </div>
  )
}

function Row({ term, children }: { term: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[13px] font-semibold text-secondary">{term}</dt>
      <dd className="mt-1 text-[15px] text-primary">{children}</dd>
    </div>
  )
}

function RateTable({
  rows,
}: {
  rows: { name: string; price: number; threshold: number; apps: number; appNames?: string[] }[]
}) {
  return (
    <table className="w-full text-[13px]">
      <thead>
        <tr className="border-b border-default text-left">
          <th scope="col" className="py-2 font-semibold text-secondary">Tier</th>
          <th scope="col" className="py-2 text-right font-semibold text-secondary">Unit rate</th>
          <th scope="col" className="py-2 text-right font-semibold text-secondary">Threshold</th>
          <th scope="col" className="py-2 pl-6 font-semibold text-secondary">Applications</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.name} className="border-b border-divider last:border-0">
            <td className="py-2.5 font-semibold text-primary">{r.name}</td>
            <td className="num py-2.5 text-right font-mono text-primary">{rate(r.price)}</td>
            <td className="num py-2.5 text-right font-mono text-primary">
              {r.threshold === 0 ? 'None' : r.threshold.toLocaleString()}
            </td>
            <td className="py-2.5 pl-6 text-secondary">
              {r.appNames ? r.appNames.map(appLabel).join(', ') : `${r.apps} applications`}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

/* ---------------------------------------------------------------------- */
/* Editable state                                                          */
/* ---------------------------------------------------------------------- */

/**
 * A unit-rate number input that always displays two decimals (0.10, not 0.1) once
 * settled, without fighting the user mid-keystroke — reformatting on every change
 * (rather than on blur) would rewrite the field out from under active typing (try
 * typing "0.15" into a field that re-renders to "0.10" the instant you type the "1").
 *
 * `value === undefined` renders as an empty, unset field showing `placeholder`
 * (a suggested default) in grey rather than a real value — used for the per-tier
 * rate inputs, which start blank so an Admin can't silently inherit a suggestion
 * they never actually looked at.
 */
function RateInput({
  id,
  ariaLabel,
  describedBy,
  value,
  placeholder,
  onChange,
}: {
  id?: string
  ariaLabel?: string
  describedBy?: string
  value: number | undefined
  placeholder?: string
  onChange: (n: number | undefined) => void
}) {
  const [text, setText] = useState(() => (value === undefined ? '' : value.toFixed(2)))

  return (
    <Input
      id={id}
      aria-label={ariaLabel}
      aria-describedby={describedBy}
      type="number"
      min={0}
      max={4}
      step={0.01}
      placeholder={placeholder}
      value={text}
      onChange={(e) => {
        setText(e.target.value)
        if (e.target.value === '') {
          onChange(undefined)
        } else {
          const n = Number(e.target.value)
          if (!Number.isNaN(n)) onChange(n)
        }
      }}
      onBlur={() => {
        if (text === '') return
        const n = Number(text) || 0
        setText(n.toFixed(2))
        onChange(n)
      }}
    />
  )
}

function RuleForm({
  rule: initial,
  workspaceId,
  region,
  email,
}: {
  rule: Rule
  workspaceId: number
  region: Region
  email: string
}) {
  const navigate = useNavigate()
  const { environment } = useSession()
  // Per-tier unit prices start empty, not pre-filled from the server's suggested
  // defaults (`initial.unitPrices`, kept below as-is for placeholder text) — the
  // Admin must explicitly type a rate for every tier in use rather than silently
  // inheriting a suggestion they never looked at.
  const [rule, setRule] = useState<Rule>(() => ({ ...initial, unitPrices: {} }))
  const [confirming, setConfirming] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [touched, setTouched] = useState(false)

  const patch = (p: Partial<Rule>) => setRule((r) => ({ ...r, ...p }))

  const activeApps = RULE_APPS.filter((a) => !(rule.isAppExcluded && rule.jobExcludeList[a]))
  // Same defensive filter as RuleSummary — the server defaults every app to
  // Tier_1 for a not-yet-defined rule, so this shouldn't be reachable here in
  // practice, but a missing entry crashing the whole form is a bad trade for
  // skipping one filter.
  const usedTiers = useMemo(
    () => [...new Set(
      activeApps.map((a) => rule.jobGroupList[a]).filter((t): t is string => Boolean(t)),
    )].sort(),
    [activeApps, rule.jobGroupList],
  )

  // Validation mirrors BillingStatusViewModel.Validate.
  const errors: Record<string, string> = {}
  if (!rule.isTest) {
    if (rule.sameUnitPrice && rule.unitPrice < 0) {
      errors.unitPrice = 'Enter a unit rate of zero or more.'
    }
    if (rule.isAppExcluded && !Object.values(rule.jobExcludeList).some(Boolean)) {
      errors.excluded = 'Select at least one application to exclude, or answer No above.'
    }
    if (!rule.sameUnitPrice) {
      for (const t of usedTiers) {
        const price = rule.unitPrices[t]
        if (price === undefined) {
          errors.tiers = 'Enter a unit rate for every tier in use — the greyed-out values are only suggestions.'
        } else if (price < 0) {
          errors.tiers = 'Tier rates must be zero or more.'
        }
      }
    }
    if (rule.chatUnitPrice < 0) {
      errors.chatUnitPrice = 'Enter a unit rate of zero or more.'
    }
    if (rule.chatPeriod < 0) {
      errors.chatPeriod = 'Enter a period of zero or more (zero disables Vero billing).'
    }
    if ((rule.chatUnitPrice === 0 || rule.chatPeriod === 0) && !rule.veroExceptionReason?.trim()) {
      errors.veroExceptionReason = 'A reason is required when the Vero unit price or period is zero.'
    }
  }
  const valid = Object.keys(errors).length === 0

  const handleSave = async () => {
    setSaving(true)
    setSaveError(null)
    // A used tier whose price/threshold input was never touched has no entry in
    // rule.unitPrices/thresholdValues — the displayed "0" comes only from the `?? 0`
    // fallback at render time, so the server sees the tier as missing rather than
    // zeroed and rejects it. Fill in the same fallback here before sending.
    const payload: Rule = rule.sameUnitPrice
      ? rule
      : {
          ...rule,
          unitPrices: Object.fromEntries(usedTiers.map((t) => [t, rule.unitPrices[t] ?? 0])),
          thresholdValues: Object.fromEntries(
            usedTiers.map((t) => [t, rule.thresholdValues[t] ?? 0]),
          ),
        }
    const result = await saveBillingRule(workspaceId, environment, payload, email, region)
    setSaving(false)
    if (result.ok) {
      setConfirming(false)
      navigate(`/projects/${region}/${workspaceId}`)
    } else {
      setSaveError(result.message)
      setConfirming(false)
    }
  }

  return (
    <div className="space-y-5">
      <Breadcrumb workspaceId={workspaceId} region={region} />

      <header>
        <h1 className="font-display text-[31px] leading-[38px] text-primary">
          Set Billing Rule
        </h1>
        <p className="mt-1 text-[15px] leading-6 text-secondary">{rule.workspaceName}</p>
      </header>

      <div className="flex items-start gap-3 rounded-[10px] border border-[#F0D9A8] bg-warning-bg px-4 py-3">
        <Lock className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
        <p className="text-[14px] leading-5 text-primary">
          <span className="font-semibold">This rule can only be set once.</span> After saving it
          cannot be edited here — changes go through the Analytics Institute. Check the summary
          before you save.
        </p>
      </div>

      {saveError && (
        <div role="alert" className="rounded-[10px] border border-[#EFC4C0] bg-danger-bg px-4 py-3 text-[14px] text-primary">
          {saveError}
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-5">
          <Card>
            <CardHeader title="Billing Questions" />
            <CardBody className="space-y-7">
              <fieldset>
                <legend className="text-[15px] font-semibold text-primary">
                  Is this a billable workspace?
                </legend>
                <div className="mt-3 flex gap-6">
                  <Radio
                    name="isTest"
                    label="Yes"
                    checked={!rule.isTest}
                    onChange={() => patch({ isTest: false })}
                  />
                  <Radio
                    name="isTest"
                    label="No — this is a test workspace"
                    checked={rule.isTest}
                    onChange={() => patch({ isTest: true })}
                  />
                </div>
              </fieldset>

              {!rule.isTest && (
                <>
                  <fieldset>
                    <legend className="text-[15px] font-semibold text-primary">
                      Are any applications excluded from billing?
                    </legend>
                    <div className="mt-3 flex gap-6">
                      <Radio
                        name="isAppExcluded"
                        label="Yes"
                        checked={rule.isAppExcluded}
                        onChange={() => patch({ isAppExcluded: true })}
                      />
                      <Radio
                        name="isAppExcluded"
                        label="No"
                        checked={!rule.isAppExcluded}
                        onChange={() => patch({ isAppExcluded: false })}
                      />
                    </div>

                    {rule.isAppExcluded && (
                      <div className="mt-4 rounded-[10px] border border-default bg-surface-muted p-4">
                        <p className="mb-3 text-[13px] font-semibold text-secondary">
                          Select the applications that are not billed
                        </p>
                        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                          {RULE_APPS.map((app) => (
                            <Checkbox
                              key={app}
                              label={appLabel(app)}
                              checked={rule.jobExcludeList[app]}
                              onChange={(e) =>
                                patch({
                                  jobExcludeList: {
                                    ...rule.jobExcludeList,
                                    [app]: e.target.checked,
                                  },
                                })
                              }
                            />
                          ))}
                        </div>
                        {touched && errors.excluded && (
                          <p className="mt-3 text-[12.5px] text-danger">{errors.excluded}</p>
                        )}
                      </div>
                    )}
                  </fieldset>

                  <fieldset>
                    <legend className="text-[15px] font-semibold text-primary">
                      Do all applications use the same rate and threshold? (Default tiers
                      shown - please confirm or adjust)
                    </legend>
                    <div className="mt-3 flex gap-6">
                      <Radio
                        name="sameUnitPrice"
                        label="Yes"
                        checked={rule.sameUnitPrice}
                        onChange={() => patch({ sameUnitPrice: true })}
                      />
                      <Radio
                        name="sameUnitPrice"
                        label="No — set rates per tier"
                        checked={!rule.sameUnitPrice}
                        onChange={() => patch({ sameUnitPrice: false })}
                      />
                    </div>
                  </fieldset>

                  {rule.sameUnitPrice ? (
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field
                        label="Unit rate"
                        hint="Charged per document."
                        error={touched ? errors.unitPrice : undefined}
                        required
                      >
                        {(id, describedBy) => (
                          <RateInput
                            id={id}
                            describedBy={describedBy}
                            value={rule.unitPrice}
                            onChange={(n) => patch({ unitPrice: n ?? 0 })}
                          />
                        )}
                      </Field>
                      <Field
                        label="Threshold"
                        hint="Billing starts only once accrued volume passes this. Zero bills from the first document."
                      >
                        {(id, describedBy) => (
                          <Input
                            id={id}
                            aria-describedby={describedBy}
                            type="number"
                            min={0}
                            max={10_000_000}
                            step={1}
                            value={rule.threshold}
                            onChange={(e) => patch({ threshold: Number(e.target.value) })}
                          />
                        )}
                      </Field>
                    </div>
                  ) : (
                    <div className="space-y-5">
                      <div>
                        <Label>Assign each application to a tier</Label>
                        <div className="mt-3 grid gap-3 sm:grid-cols-2">
                          {activeApps.map((app) => (
                            <label key={app} className="flex items-center gap-3">
                              <span className="w-28 shrink-0 text-[13px] text-primary">{appLabel(app)}</span>
                              <Select
                                aria-label={`Tier for ${app}`}
                                value={rule.jobGroupList[app]}
                                onChange={(e) =>
                                  patch({
                                    jobGroupList: {
                                      ...rule.jobGroupList,
                                      [app]: e.target.value,
                                    },
                                  })
                                }
                              >
                                {TIERS.map((t) => (
                                  <option key={t} value={t}>
                                    {t.replace('_', ' ')}
                                  </option>
                                ))}
                              </Select>
                            </label>
                          ))}
                        </div>
                      </div>

                      <div>
                        <Label>Rate and threshold for each tier in use</Label>
                        <p className="mt-1 text-[13px] font-bold text-danger">
                          (Default rates shown - Please confirm project rates before submission.)
                        </p>
                        <div className="mt-3 grid grid-cols-[7rem_1fr_1fr] gap-3">
                          <span />
                          <span className="text-[12.5px] font-semibold text-secondary">Unit rate</span>
                          <span className="text-[12.5px] font-semibold text-secondary">Threshold</span>
                        </div>
                        <div className="mt-2 space-y-3">
                          {usedTiers.map((t) => (
                            <div key={t} className="grid grid-cols-[7rem_1fr_1fr] items-center gap-3">
                              <span className="text-[13px] font-semibold text-primary">
                                {t.replace('_', ' ')}
                              </span>
                              <RateInput
                                ariaLabel={`Unit rate for ${t}`}
                                value={rule.unitPrices[t]}
                                placeholder={(initial.unitPrices[t] ?? 0).toFixed(2)}
                                onChange={(n) => {
                                  const next = { ...rule.unitPrices }
                                  if (n === undefined) {
                                    delete next[t]
                                  } else {
                                    next[t] = n
                                  }
                                  patch({ unitPrices: next })
                                }}
                              />
                              <Input
                                aria-label={`Threshold for ${t}`}
                                type="number"
                                min={0}
                                max={10_000_000}
                                value={rule.thresholdValues[t] ?? 0}
                                onChange={(e) =>
                                  patch({
                                    thresholdValues: {
                                      ...rule.thresholdValues,
                                      [t]: Number(e.target.value),
                                    },
                                  })
                                }
                              />
                            </div>
                          ))}
                        </div>
                        {touched && errors.tiers && (
                          <p className="mt-2 text-[12.5px] text-danger">{errors.tiers}</p>
                        )}
                      </div>
                    </div>
                  )}

                  <fieldset>
                    <legend className="text-[15px] font-semibold text-primary">
                      Vero billing rule
                    </legend>
                    <p className="mt-1 text-[13px] leading-5 text-secondary">
                      Each Vero index is charged (document count × unit price) the month it&apos;s
                      created, then again every period below for as long as it&apos;s still
                      active. A period of 0 disables Vero billing for this workspace.
                    </p>
                    <div className="mt-3 grid gap-4 sm:grid-cols-2">
                      <Field
                        label="Vero unit rate"
                        hint="Charged per document, per billing cycle."
                        error={touched ? errors.chatUnitPrice : undefined}
                        required
                      >
                        {(id, describedBy) => (
                          <RateInput
                            id={id}
                            describedBy={describedBy}
                            value={rule.chatUnitPrice}
                            onChange={(n) => patch({ chatUnitPrice: n ?? 0 })}
                          />
                        )}
                      </Field>
                      <Field
                        label="Vero period (months)"
                        hint="How often an active index is re-billed. Zero disables Vero billing."
                        error={touched ? errors.chatPeriod : undefined}
                        required
                      >
                        {(id, describedBy) => (
                          <Input
                            id={id}
                            aria-describedby={describedBy}
                            type="number"
                            min={0}
                            max={120}
                            step={1}
                            value={rule.chatPeriod}
                            onChange={(e) => patch({ chatPeriod: Number(e.target.value) })}
                          />
                        )}
                      </Field>
                    </div>

                    {(rule.chatUnitPrice === 0 || rule.chatPeriod === 0) && (
                      <div className="mt-4">
                        <Field
                          label="Vero Billing Exception Reason"
                          hint="Required because the Vero unit price or period above is zero."
                          error={touched ? errors.veroExceptionReason : undefined}
                          required
                        >
                          {(id, describedBy) => (
                            <Textarea
                              id={id}
                              aria-describedby={describedBy}
                              rows={2}
                              value={rule.veroExceptionReason ?? ''}
                              onChange={(e) => patch({ veroExceptionReason: e.target.value })}
                            />
                          )}
                        </Field>
                      </div>
                    )}
                  </fieldset>
                </>
              )}
            </CardBody>
          </Card>
        </div>

        <div className="lg:sticky lg:top-5 lg:self-start">
          <RulePreview rule={rule} activeApps={activeApps} usedTiers={usedTiers} />
          <div className="mt-4 flex flex-col gap-2">
            <Button
              variant="primary"
              onClick={() => {
                setTouched(true)
                if (valid) setConfirming(true)
              }}
            >
              Set Billing Rule
            </Button>
            <Link to={`/projects/${region}/${workspaceId}`}>
              <Button variant="secondary" className="w-full">
                Cancel
              </Button>
            </Link>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={confirming}
        title={`Set billing rule for ${rule.workspaceName}?`}
        confirmLabel="Set Billing Rule"
        busy={saving}
        onConfirm={handleSave}
        onCancel={() => setConfirming(false)}
      >
        <p className="font-semibold text-primary">This rule cannot be edited after saving.</p>
        <ul className="mt-3 space-y-1">
          <li>
            Billable:{' '}
            <span className="font-semibold text-primary">{rule.isTest ? 'No' : 'Yes'}</span>
          </li>
          {!rule.isTest && (
            <li>
              Rate:{' '}
              <span className="font-semibold text-primary">
                {rule.sameUnitPrice
                  ? `${rate(rule.unitPrice)} per document`
                  : usedTiers
                      .map((t) => `${t.replace('_', ' ')}: ${rate(rule.unitPrices[t] ?? 0)}`)
                      .join(', ')}
              </span>
            </li>
          )}
          {!rule.isTest && rule.isAppExcluded && (
            <li>
              Excluded:{' '}
              <span className="font-semibold text-primary">
                {RULE_APPS.filter((a) => rule.jobExcludeList[a]).map(appLabel).join(', ')}
              </span>
            </li>
          )}
          {!rule.isTest && (
            <li>
              Vero rate:{' '}
              <span className="font-semibold text-primary">
                {rule.chatPeriod === 0
                  ? 'Disabled'
                  : `${rate(rule.chatUnitPrice)} per document, every ${rule.chatPeriod} mo`}
              </span>
            </li>
          )}
        </ul>
        <p className="mt-3">
          Later changes are made by the Analytics Institute on request.
        </p>
      </ConfirmDialog>
    </div>
  )
}

/**
 * Live preview of what the rule will charge.
 *
 * The current form offers no way to check the effect of an irreversible
 * decision before committing it — this panel is the answer to that.
 */
function RulePreview({
  rule,
  activeApps,
  usedTiers,
}: {
  rule: Rule
  activeApps: string[]
  usedTiers: string[]
}) {
  const SAMPLE = 100_000
  const effectiveRate = rule.sameUnitPrice
    ? rule.unitPrice
    : usedTiers.length > 0
      ? usedTiers.reduce((sum, t) => sum + (rule.unitPrices[t] ?? 0), 0) / usedTiers.length
      : 0

  return (
    <Card>
      <CardHeader title="Rule Summary" />
      <CardBody className="space-y-4 text-[14px]">
        {rule.isTest ? (
          <p className="text-secondary">
            This workspace will be marked <span className="font-semibold text-primary">not
            billable</span>. Usage is still recorded, but nothing is charged.
          </p>
        ) : (
          <>
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-secondary">Billed applications</span>
              <span className="font-semibold text-primary">
                {activeApps.length} of {RULE_APPS.length}
              </span>
            </div>
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-secondary">
                {rule.sameUnitPrice ? 'Unit rate' : 'Average tier rate'}
              </span>
              <span className="font-mono font-semibold text-primary">{rate(effectiveRate)}</span>
            </div>
            {rule.sameUnitPrice && (
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-secondary">Threshold</span>
                <span className="font-mono font-semibold text-primary">
                  {rule.threshold === 0 ? 'None' : rule.threshold.toLocaleString()}
                </span>
              </div>
            )}
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-secondary">Vero rate</span>
              <span className="font-mono font-semibold text-primary">
                {rule.chatPeriod === 0 ? 'Disabled' : `${rate(rule.chatUnitPrice)} / ${rule.chatPeriod}mo`}
              </span>
            </div>

            <div className="border-t border-divider pt-4">
              <p className="text-[13px] text-secondary">
                At {SAMPLE.toLocaleString()} billable documents this project would be charged
              </p>
              <p className="mt-1 font-display text-[25px] leading-8 text-primary">
                {money(SAMPLE * effectiveRate)}
              </p>
              <p className="mt-1 text-[12.5px] text-muted">
                Illustration only, before thresholds are applied.
              </p>
            </div>
          </>
        )}
      </CardBody>
    </Card>
  )
}

function Breadcrumb({ workspaceId, region }: { workspaceId: number; region: Region }) {
  return (
    <Link
      to={`/projects/${region}/${workspaceId}`}
      className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-link hover:underline"
    >
      <ArrowLeft className="size-4" aria-hidden="true" />
      Back to project
    </Link>
  )
}
