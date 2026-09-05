/* Year range for the year-select controls, now that mock-data.ts (the only
 * previous source of these constants) is gone. The platform's earliest
 * billing data starts in 2019 (see PredictiveCodingNet's BillController). */

export const FIRST_YEAR = 2019
export const CURRENT_YEAR = new Date().getFullYear()

/** Newest first, for year-select dropdowns. */
export const AVAILABLE_YEARS = Array.from(
  { length: CURRENT_YEAR - FIRST_YEAR + 1 },
  (_, i) => CURRENT_YEAR - i,
)

/** Oldest first. */
export const HISTORY_YEARS = [...AVAILABLE_YEARS].reverse()
