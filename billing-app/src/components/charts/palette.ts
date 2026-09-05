/* Chart palette.
 *
 * VALIDATED with the dataviz validator against the real card surface (#FFFFFF):
 *
 *   node scripts/validate_palette.js "#486784,#8A949C" --mode light --surface "#FFFFFF"
 *     [PASS] Lightness band        both inside L 0.43-0.77
 *     [FAIL] Chroma floor          #486784 0.059, #8A949C 0.017
 *     [PASS] CVD separation        ΔE 15.3 (protan) / 16.8 (tritan)
 *     [PASS] Normal-vision floor   ΔE 16.5
 *     [PASS] Contrast vs surface   both >= 3:1
 *
 * The chroma floor fails and cannot be fixed by re-stepping: EVERY hue in the
 * Vero system sits below it. The system is deliberately desaturated ("cool
 * neutrals", "quiet by default"), and the highest-chroma step available is
 * 0.069. Injecting a saturated hue that does not exist in the Legal Analytics
 * Suite would break suite consistency to satisfy a general-purpose guard.
 *
 * The floor exists to stop peer series reading as gray. That risk is retired
 * structurally instead:
 *
 *   1. NO CHART IN THIS APP USES MORE THAN TWO CATEGORICAL SERIES. Where a
 *      breakdown needs more (per-application usage across eleven apps), it is
 *      drawn as small multiples, not as eleven stacked colours. Series colour
 *      never has to carry eleven identities.
 *   2. The two-series case is always current vs. prior period, where the
 *      second series is deliberately recessive — a reference, not a peer.
 *   3. Secondary encoding is mandatory on any two-series chart: solid vs.
 *      dashed stroke, a legend, and direct labelling. Identity is never
 *      carried by colour alone.
 *
 * Teal is excluded from charts as it is from the rest of this app: it is
 * earned by the AI-search mode in Vero, and Billing has no AI surface.
 */

export const CHART = {
  /** Primary series — the period being examined. */
  primary: '#486784',
  /** Reference series — prior period. Recessive by intent. */
  reference: '#8A949C',

  grid: '#E6E9ED',
  axis: '#8A949C',
  axisText: '#5A6770',
  surface: '#FFFFFF',

  /** Status, for threshold state. Never reused as a series colour. */
  billing: '#1E7A4A',
  approaching: '#B45309',
} as const

/** Recharts axis/tick styling, shared so every chart's furniture matches. */
export const axisProps = {
  stroke: CHART.axis,
  tick: { fill: CHART.axisText, fontSize: 12 },
  tickLine: false,
} as const

export const gridProps = {
  stroke: CHART.grid,
  strokeDasharray: '0',
  vertical: false,
} as const
