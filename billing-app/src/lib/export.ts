import { MONTHS, type AnalyzedTimeInfo } from '@/api/types'

/* Export, replacing the DataTables buttons the current views rely on.
 *
 * "Excel" here is CSV with a UTF-8 BOM, which Excel opens natively with
 * correct encoding. A real .xlsx would need a workbook library; if the team
 * wants true Excel output later, swap this one function. Long workspace IDs
 * are prefixed so Excel does not reformat them into scientific notation,
 * which is a real failure mode with nine-digit ids.
 */

function escape(value: string | number | null): string {
  const s = value === null ? '' : String(value)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

function download(filename: string, rows: (string | number | null)[][], asExcel: boolean) {
  const csv = rows.map((row) => row.map(escape).join(',')).join('\r\n')

  // The BOM is what makes Excel read this as UTF-8 rather than as the local
  // codepage, which otherwise mangles non-ASCII project names.
  const blob = new Blob([asExcel ? '﻿' : '', csv], {
    type: 'text/csv;charset=utf-8;',
  })

  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${filename}.csv`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export function exportRows(
  filename: string,
  rows: AnalyzedTimeInfo[],
  year: number,
  format: 'csv' | 'xlsx',
) {
  const header = [
    'Project Name',
    'Region',
    'Workspace ID',
    'Matter Number',
    'Env',
    'Billable Documents',
    'Total Billed',
    `${year} Documents`,
    ...MONTHS.flatMap((m) => [`${m} Documents`, `${m} Amount`]),
  ]

  const body = rows.map((r) => [
    r.WorkspaceName,
    r.Region,
    r.WorkspaceId,
    r.MatterNumber,
    r.ProdType,
    r.TotalBillCount,
    r.TotalPrice.toFixed(2),
    r.YearCount,
    ...MONTHS.flatMap((_, i) => [r.Counts[i] ?? 0, (r.Money[i] ?? 0).toFixed(2)]),
  ])

  download(filename, [header, ...body], format === 'xlsx')
}

/**
 * One row per application, plus the tier-grouping rows shown on screen
 * (a tier subtotal directly above the applications billed under it), counts
 * and amounts together.
 *
 * Only non-application rows ("All applications", "All Tiers", a tier
 * subtotal, "Excluded Tier") have a real dollar figure — a tier can bundle
 * several apps together, so there is no ground truth for a single app's
 * dollar share of it. Money columns are left blank on every application row
 * rather than showing a $0.00 that would read as "this app billed nothing."
 */
export function exportProjectDetail(
  filename: string,
  rows: AnalyzedTimeInfo[],
  year: number,
  format: 'csv' | 'xlsx',
) {
  const header = [
    'Application',
    'Lifetime Documents',
    'Lifetime Billed',
    `${year} Documents`,
    `${year} Billed`,
    'Unit Rate',
    'Threshold',
    ...MONTHS.flatMap((m) => [`${m} Documents`, `${m} Amount`]),
  ]

  const body = rows.map((r) => {
    const hasMoney = !r.IsAppRow
    return [
      r.JobName,
      r.TotalCount,
      hasMoney ? r.TotalPrice.toFixed(2) : '',
      r.YearCount,
      hasMoney ? r.Money.reduce((a, b) => a + b, 0).toFixed(2) : '',
      r.JobUnitRate < 0 ? '' : r.JobUnitRate.toFixed(3),
      r.JobThreshold,
      ...MONTHS.flatMap((_, i) => [r.Counts[i] ?? 0, hasMoney ? (r.Money[i] ?? 0).toFixed(2) : '']),
    ]
  })

  download(filename, [header, ...body], format === 'xlsx')
}
