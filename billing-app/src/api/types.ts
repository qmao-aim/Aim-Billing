/* Data contract.
 *
 * These types mirror the shapes the existing ASP.NET application already
 * returns, so the backend swap is a change of transport, not of model:
 *   AnalyzedTimeInfo    -> PredictiveCodingNet/Models/PCStatusCheckModel.cs:163
 *   BillingRule         -> PredictiveCodingNet/ViewModels/BillingStatusViewModel.cs
 *   JobColumnNames      -> PredictiveCodingNet/Models/GeneralModel.cs:44
 *
 * Field names are kept in the server's PascalCase so JSON from the real API
 * deserialises without a mapping layer.
 */

/**
 * The billable analytics applications, in server order.
 *
 * This is the full roster from GeneralModel.JobColumnNames / PCStatusCheckModel's
 * `billing` table columns — it used to list only 11 apps, silently dropping
 * Chat (Vero — actively billed, via its own dedicated tier), Privilege, Mine,
 * ConstructionPredict, and PrivLog from every usage/dashboard figure.
 */
export const APPS = [
  'TextPredict',
  'DeDupe',
  'Thread',
  'TextCluster',
  'Expand',
  'Explore',
  'Sentimize',
  'Emoji',
  'ImagePredict',
  'ImageCluster',
  'Footer',
  'Privilege',
  'Mine',
  'ConstructionPredict',
  'Chat',
  'PrivLog',
] as const

export type AppName = (typeof APPS)[number]

/**
 * The roster the rule-setting screen actually offers — GeneralModel.JobColumnNames
 * on the server. DeDupe and Thread are historical `billing` columns with no
 * rule-engine support (the server never writes a tier for them), and Chat/Vero is
 * always billed under its own dedicated tier, configured separately — neither
 * belongs on the "exclude this app" / "assign this app a tier" screen.
 */
export const RULE_APPS = APPS.filter(
  (app) => app !== 'DeDupe' && app !== 'Thread' && app !== 'Chat',
)

/** Display label for an app key — Chat bills under the product name "Vero",
 * Footer under "Detect", and PrivLog under "Privilege Narrator"; every other
 * key displays as-is. Mirrors the server's AppMetadata.GetDisplayName. */
export const APP_LABELS: Record<AppName, string> = Object.fromEntries(
  APPS.map((app) => [app, app]),
) as Record<AppName, string>
APP_LABELS.Chat = 'Vero'
APP_LABELS.Footer = 'Detect'
APP_LABELS.PrivLog = 'Privilege Narrator'

/**
 * Safe lookup for anywhere a server-supplied JobName is rendered — covers real
 * app keys via APP_LABELS, and passes through anything else (e.g. the "All
 * applications" summary row) unchanged rather than requiring every call site
 * to type-narrow first.
 */
export function appLabel(jobName: string): string {
  return (APP_LABELS as Record<string, string>)[jobName] ?? jobName
}

export const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
] as const

/** Prod / Dev. Maps to the server's `suffix` parameter ('' | '_Dev'). */
export type Environment = 'prod' | 'dev'

/**
 * Which region's billing database to read. 'global' means every region,
 * merged server-side into one combined result (one list, one total) — it's
 * never a real database on its own.
 */
export type Region = 'global' | 'us' | 'uk'

export const REGIONS: { value: Region; label: string }[] = [
  { value: 'global', label: 'Global' },
  { value: 'us', label: 'US' },
  { value: 'uk', label: 'UK' },
]

/**
 * A single year, or the platform's entire history.
 *
 * On the server, `'all'` means "drop the year predicate" rather than
 * "enumerate every year" — the queries behind these endpoints already
 * aggregate, so removing the WHERE clause is both simpler and faster than
 * summing per-year results.
 */
export type YearFilter = number | 'all'

export type Role = 'pm' | 'admin'

/**
 * One row of analyzed-time data. Used for both the portfolio table (one row
 * per project) and the project detail table (one row per application), which
 * is why some fields are only meaningful in one context — this mirrors the
 * server model rather than improving on it.
 */
export interface AnalyzedTimeInfo {
  /** "US"/"UK", or "Global" on the synthetic combined-total row — which region
   * this specific row actually came from, needed to link to it correctly when
   * the list itself was requested with region=global (a merge of both). */
  Region: string
  WorkspaceId: number
  WorkspaceName: string
  MatterNumber: string | null
  ProdType: string
  UnitPrice: number
  /** Application name, or a 'Tier_N' / 'Excluded' / 'All' grouping row. */
  JobName: string
  /** True for a genuine per-application row. False for a synthetic grouping row
   * ("All applications", "All Tiers", a tier subtotal, "Excluded Tier") — needed
   * because Vero's dedicated tier is literally named "Chat", identical to the
   * real "Chat" app row's JobName, so JobName text alone can't tell them apart. */
  IsAppRow: boolean
  TotalCount: number
  TotalBillCount: number
  TotalPrice: number
  YearCount: number
  JobUnitRate: number
  JobThreshold: number
  /** Document counts, January..December. Always length 12. */
  Counts: number[]
  /** Dollar amounts, January..December. Always length 12. */
  Money: number[]
}

/**
 * A project's billing rule.
 *
 * `isDefined` mirrors the server's tri-state `IsDefined()`:
 *   -1  undefined — no rule set yet, the form is editable
 *    0  billable  — a rule exists and is locked
 *    1  test      — marked non-billable and locked
 */
export type RuleState = -1 | 0 | 1

export interface TierRate {
  tier: string
  price: number
  threshold: number
}

export interface BillingRule {
  workspaceId: number
  workspaceName: string
  isDefined: RuleState
  /** true = NOT a billable workspace. Named to match the server field. */
  isTest: boolean
  isAppExcluded: boolean
  sameUnitPrice: boolean
  unitPrice: number
  threshold: number
  /** Vero/Chat unit rate — charged per document, separately from the tiers above. */
  chatUnitPrice: number
  /** Months between Vero re-billing of an active index. 0 disables Vero billing. */
  chatPeriod: number
  /** On submit: plain reason text, required when chatUnitPrice or chatPeriod is 0. On
   * read, once set: a JSON string `{"<savedBy email>": "<reason>"}` — null otherwise. */
  veroExceptionReason: string | null
  /** app -> excluded from billing */
  jobExcludeList: Record<string, boolean>
  /** app -> tier key */
  jobGroupList: Record<string, string>
  /** tier key -> unit price */
  unitPrices: Record<string, number>
  /** tier key -> threshold */
  thresholdValues: Record<string, number>
  createdBy: string | null
  /** ISO 8601, or null when no rule has been set. */
  createdOn: string | null
}

/**
 * AI/Azure compute cost — what Ankura pays Azure/OpenAI to run Vero, Summarization,
 * and Image Caption, not what a client is billed (that's BillingRule/AnalyzedTimeInfo).
 * Ports PredictiveCodingNet.Models.PCStatusCheckModel's LLMChatCostRow/
 * SummarizationCostRow/ImageCaptionCostRow. New types, no legacy JSON precedent, so —
 * like every non-AnalyzedTimeInfo type here — camelCase on the wire. None of the three
 * underlying tables have a Dev variant, so there is no `environment` dimension for
 * these at all (Prod only).
 */
export interface LlmChatCost {
  region: string
  workspaceId: number
  workspaceName: string
  year: number
  month: number
  blobStorageCost: number
  indexCost: number
  conversationCost: number
  totalCost: number
  documentCount: number
  inputTokenCount: number
  outputTokenCount: number
}

export interface SummarizationCost {
  region: string
  workspaceId: number
  workspaceName: string
  appName: string
  year: number
  month: number
  count: number
  totalCost: number
  totalInputTokenCount: number
  totalOutputTokenCount: number
}

export interface ImageCaptionCost {
  region: string
  workspaceId: number
  workspaceName: string
  year: number
  month: number
  imageCount: number
  totalCost: number
}

export interface ProjectSummary {
  workspaceId: number
  workspaceName: string
  matterNumber: string | null
  prodType: string
  isTest: boolean
  ruleState: RuleState
  effectiveRate: number
  syncedOn: string
}

/**
 * Billing sync health. The current application blocks the page with a modal
 * when the last sync is over 65 minutes old; here it becomes a dismissible
 * banner so it cannot stop someone reading the data.
 */
export interface ConnectionStatus {
  online: boolean
  lastSyncedOn: string
  minutesSinceSync: number
}

export interface PortfolioTotals {
  totalBilled: number
  totalDocuments: number
  activeProjects: number

  /**
   * The trend series and its x-axis labels.
   *
   * The bucket changes with the filter: twelve months for a single year,
   * one point per year for 'all'. The series carries its own labels so the
   * chart never has to infer the bucket from the array length.
   */
  series: { label: string; value: number }[]
  /**
   * The same series one period earlier, for comparison. Null under 'all',
   * where there is no earlier period to compare the whole history against.
   */
  priorSeries: { label: string; value: number }[] | null
  /** Legend/caption for `series` and `priorSeries` — e.g. "2026" / "2025". */
  seriesLabel: string
  priorSeriesLabel: string | null
  /**
   * Caveat shown with the trend chart, or null when there is nothing to warn
   * about. The all-time view ends on a year still in progress, and without
   * saying so its final point reads as a downturn rather than as a month
   * count.
   */
  seriesNote: string | null

  /** Percentage change between the two most recent complete buckets. */
  changePct: number
  /** What that change compares, e.g. "July vs. June" or "2025 vs. 2024". */
  changeLabel: string
}

/**
 * Portfolio-wide document volume for one app. No dollar figure: the legacy
 * system has never computed a per-app dollar breakdown (only per-tier, and a
 * tier can bundle several apps together), so this deliberately doesn't invent
 * one — dollar totals stay at the tier/project/portfolio level, where exact
 * numbers exist.
 */
export interface AppUsage {
  app: AppName
  documents: number
}
