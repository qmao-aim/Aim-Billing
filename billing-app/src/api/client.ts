/* THE BACKEND SEAM — now wired to the standalone Billing app's Web API.
 *
 *   getProjects            -> GET  /api/projects
 *   getProjectDetail       -> GET  /api/projects/{workspaceId}/detail
 *   getBillingRule         -> GET  /api/projects/{workspaceId}/rule
 *   saveBillingRule        -> POST /api/projects/{workspaceId}/rule
 *   getConnectionStatus    -> GET  /api/connection-status
 *   getPortfolioTotals     -> GET  /api/portfolio-totals
 *   getAppUsage            -> GET  /api/app-usage
 *   getRateDistribution    -> GET  /api/rate-distribution
 *   getLlmChatCosts        -> GET  /api/ai-costs/llm-chat
 *   getSummarizationCosts  -> GET  /api/ai-costs/summarization
 *   getImageCaptionCosts   -> GET  /api/ai-costs/image-caption
 *   getFinancialReport     -> GET  /api/financial-report
 *
 * The app is served by the same ASP.NET site it calls, so these are
 * same-origin requests carrying the OWIN auth cookie — no CORS, no token
 * handling here. `Environment`: 'prod' -> server suffix '', 'dev' -> '_Dev'
 * (the server does this mapping; the client just passes 'prod' | 'dev').
 */

import type {
  AnalyzedTimeInfo,
  AppUsage,
  BillingRule,
  ConnectionStatus,
  Environment,
  FinancialReportRow,
  ImageCaptionCost,
  LlmChatCost,
  PortfolioTotals,
  Region,
  SummarizationCost,
  YearFilter,
} from './types'
import { withBasePath } from '@/lib/basePath'

type QueryValue = string | number | boolean | undefined

function buildQuery(params: Record<string, QueryValue>): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) search.set(key, String(value))
  }
  const qs = search.toString()
  return qs ? `?${qs}` : ''
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (res.status === 401) {
    // Session cookie missing or expired — bounce to the real login page rather
    // than rendering an error inside the SPA shell.
    window.location.href = withBasePath('Account/Login')
    return new Promise<T>(() => {})
  }
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new Error(body?.message ?? `Request failed (${res.status})`)
  }
  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

async function apiGet<T>(path: string, params: Record<string, QueryValue> = {}): Promise<T> {
  const res = await fetch(`${withBasePath(path)}${buildQuery(params)}`, { credentials: 'same-origin' })
  return handleResponse<T>(res)
}

async function apiPost<T>(
  path: string,
  params: Record<string, QueryValue>,
  body: unknown,
): Promise<T> {
  const res = await fetch(`${withBasePath(path)}${buildQuery(params)}`, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return handleResponse<T>(res)
}

export async function getProjects(
  year: YearFilter,
  env: Environment,
  includeTest: boolean,
  region: Region,
): Promise<AnalyzedTimeInfo[]> {
  return apiGet('/api/projects', { year, env, includeTest, region })
}

/** `region` must be a specific region (never 'global') — a project belongs to exactly one. */
export async function getProjectDetail(
  workspaceId: number,
  year: number,
  env: Environment,
  region: Region,
): Promise<AnalyzedTimeInfo[]> {
  return apiGet(`/api/projects/${workspaceId}/detail`, { year, env, region })
}

export async function getBillingRule(
  workspaceId: number,
  env: Environment,
  region: Region,
): Promise<BillingRule | null> {
  return apiGet(`/api/projects/${workspaceId}/rule`, { env, region })
}

/**
 * Persist a billing rule. Write-once: the server refuses to overwrite a rule
 * that is already defined, and the UI must not offer the option.
 *
 * `savedBy` is sent for shape compatibility, but the server derives the
 * actual attribution from the authenticated session — it never trusts this
 * field, so a caller cannot attribute a change to someone else.
 */
export async function saveBillingRule(
  workspaceId: number,
  env: Environment,
  rule: BillingRule,
  savedBy: string,
  region: Region,
): Promise<{ ok: true } | { ok: false; message: string }> {
  return apiPost(`/api/projects/${workspaceId}/rule`, { env, region }, { ...rule, savedBy })
}

export async function getConnectionStatus(region: Region): Promise<ConnectionStatus> {
  return apiGet('/api/connection-status', { region })
}

export async function getPortfolioTotals(
  year: YearFilter,
  env: Environment,
  region: Region,
): Promise<PortfolioTotals> {
  return apiGet('/api/portfolio-totals', { year, env, region })
}

export async function getAppUsage(year: YearFilter, env: Environment, region: Region): Promise<AppUsage[]> {
  return apiGet('/api/app-usage', { year, env, region })
}

/** Effective rates across the portfolio, for the rate-in-context chart. */
export async function getRateDistribution(env: Environment, region: Region): Promise<number[]> {
  return apiGet('/api/rate-distribution', { env, region })
}

/** No `env` param on any of these three — the underlying tables are Prod-only. */
export async function getLlmChatCosts(
  region: Region,
  year: YearFilter,
): Promise<LlmChatCost[]> {
  return apiGet('/api/ai-costs/llm-chat', { region, year })
}

export async function getSummarizationCosts(
  region: Region,
  year: YearFilter,
): Promise<SummarizationCost[]> {
  return apiGet('/api/ai-costs/summarization', { region, year })
}

export async function getImageCaptionCosts(
  region: Region,
  year: YearFilter,
): Promise<ImageCaptionCost[]> {
  return apiGet('/api/ai-costs/image-caption', { region, year })
}

export async function getFinancialReport(
  env: Environment,
  region: Region,
  year: number,
  month: number,
): Promise<FinancialReportRow[]> {
  return apiGet('/api/financial-report', { env, region, year, month })
}
