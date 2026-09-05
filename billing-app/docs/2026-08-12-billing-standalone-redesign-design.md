# Legal Analytics Suite — Billing: standalone redesign

**Date:** 2026-08-12
**Status:** Approved for implementation
**Owner:** Bob Neary, LTDA
**Supersedes:** the in-Relativity `Bill` views (`PredictiveCodingNet/Views/Bill/`)

---

## 1. Context

The billing application currently lives inside Relativity as six ASP.NET MVC Razor views — three screens, each duplicated with a `_Dev` suffix — rendered inside Relativity's Bootstrap chrome. This project extracts it into a standalone web application hosted on an internal Ankura server, reskinned to the Vero design system.

**Scope of this spec: the front end only.** The backend is out of scope and will be wired up separately by the platform team. This build ships against a typed mock data layer designed as a drop-in seam for the real API.

### What exists today

| View | Purpose |
|---|---|
| `AnalyzedTimeProjects.cshtml` | Portfolio table — every project × 12 months × (document count, dollar amount), plus totals. Year dropdown, DataTables, Excel/CSV export. A second "Test Workspaces" table below. |
| `AnalyzedTime.cshtml` | Single-project drill-down — per-app monthly document counts, grouped under tier header rows. |
| `AnalyzedTimeRule.cshtml` | Rate entry — billable Y/N → apps excluded Y/N → same rate for all apps Y/N → per-app tier assignment → unit price and threshold per tier. |

### Purpose of the application

1. **Project managers set billing rates** for their projects across the analytics applications.
2. **The organization sees usage and charges** — how many documents ran through each application, at what rate, and what would be billed for a given month.

---

## 2. Goals and non-goals

### Goals

- A standalone, statically-hosted front end that no longer depends on Relativity chrome or Relativity page hosting.
- Visual and interaction parity with the shipped Vero production app, so Billing reads as part of the Legal Analytics Suite.
- Charts and graphs that make usage and spend legible without reading a 31-column table.
- A clean, typed seam for the platform team to attach the real backend.
- Fix the legibility, correctness, and accessibility defects catalogued in §10.

### Non-goals

- Backend, authentication, or data-access implementation.
- Dark theme (see §11).
- Changing the billing calculation logic, tier model, or database schema.
- Migrating or replacing the `_Dev` environment's underlying data path.
- Effective-dated or editable rates — billing rules remain write-once (see §6.4).

---

## 3. Users and roles

Two roles. Role resolution is stubbed behind a provider with a single swap point for real auth.

| Capability | PM | Admin |
|---|---|---|
| Landing screen | Projects | **Dashboard** |
| Dashboard / portfolio charts | — | ✓ |
| Projects table (full portfolio) | ✓ | ✓ |
| Project detail and charts | ✓ | ✓ |
| Set billing rule | ✓ | ✓ |
| Prod/Dev environment switch | — (locked to Prod) | ✓ |
| Test workspaces filter | — | ✓ |

**PMs see the full portfolio table**, not a filtered subset — no project-ownership data is required from the backend.

**Admin-only controls are hidden, not disabled.** A disabled control a user can never enable is a dead end. Hiding the environment switch from PMs also removes the risk of a rate being set against Dev by mistake — a real hazard today, given four near-identical page sets distinguished only by a URL suffix.

There is no cross-project rate-audit view in this scope.

---

## 4. Information architecture

```
/                    → role redirect: Admin → /dashboard, PM → /projects
/dashboard           → Admin only. Portfolio charts and KPI tiles
/projects            → Portfolio table (§6.2)
/projects/:id        → Project detail: usage table + charts (§6.3)
/projects/:id/rate   → Billing rule, write-once (§6.4)
```

**Header nav** reads `Dashboard | Projects` for Admins and `Projects` for PMs. The active item is a filled navy pill on the gradient, matching Vero.

Direct navigation to `/dashboard` as a PM redirects to `/projects` rather than showing a permission error.

---

## 5. Design system application

The app consumes the Vero token layer. It does not fork the palette. Three corrections apply, all established by measuring the production screenshots supplied 2026-08-12.

### 5.1 Chrome gradient — corrected

Sampled from `header_gradient.png` (1920×108):

```css
--vero-chrome-gradient: linear-gradient(90deg,
  #142129 0%,     /* rgb(20, 33, 41)   */
  #2A5753 50%,    /* rgb(42, 87, 83)   */
  #3D8476 100%    /* rgb(61, 132, 118) */
);
```

The skill's documented stops (`#16212E → #3E8778`) are within ~5 points per channel but are not exact; the measured values are used. The midpoint stop is required — a plain two-stop gradient interpolates to `#295350` at center where the real bar is `#2A5753`.

The bar reads green-black → sea green. A slight navy cast exists only in roughly the leftmost 5%; by 10% across, green has overtaken blue.

**Contrast constraint.** White text on the gradient runs 16.42:1 at the left down to **4.41:1 at the right edge**, failing WCAG AA for normal-size text across the rightmost ~2% (final ~35px). Consequences:

- Header controls must stay clear of the final 40px.
- The environment switch renders on a solid chip background, not as bare text on the gradient. It is a state indicator and needs to be unmissable regardless.
- Left-aligned nav is never at risk (contrast there exceeds 12:1).

### 5.2 Teal is absent from this application

In production, teal is earned exclusively by the AI-search / discovery mode. Billing has no AI surface. **Teal therefore appears nowhere in this app** except the footer `Info` link, which is chrome. The working palette is: gradient chrome, blue (`#486784`) actions, cool neutrals, and the three semantics. Orange remains identity-only, in the logo.

### 5.3 Casing — match production

Production ships **Title Case page headings** ("Manage Index Inventory", "Create Vero Index", "Chat With Jeb_Bush"). This conflicts with the skill's stated sentence-case rule; production wins for suite consistency.

- **Page headings:** Title Case — "Analytics Usage", "Project Billing Rule", "Billing Dashboard"
- **Ledes, body, helper text, table content:** sentence case
- **Buttons:** Title Case — "Export to Excel", "Set Billing Rule"
- **No emoji anywhere.**

### 5.4 Component vocabulary, from the production screenshots

- **Buttons:** navy fill / white label (primary), white fill with gray border (secondary), solid red (destructive), flat gray (disabled).
- **Badges:** two treatments in production — subtle tint-on-light (Manage "Created") and solid fill (Citations "Cited"). Billing uses the subtle tint form for status.
- **Tables:** retain the DataTables furniture users already read fluently — "Show 25 entries", "Search:", "Showing 1 to 20 of 340 entries", and Previous/N/Next with the active page as a filled navy square.
- **Monospace** for workspace IDs, matter numbers, dates, and timestamps, matching production's treatment of control numbers.
- **Cards:** white surface, 10px radius, `neutral-200` hairline, `shadow-1`, 24px padding, on `#F7F8FA`.
- **Focus:** 2px `#486784` ring with 2px offset on `:focus-visible`, never removed.
- **Footer:** charcoal `#505555` band, centered copyright, teal `Info` link at far left.

### 5.5 Logo

The header names the **suite**, not Vero: "Ankura Legal Analytics Suite / Billing". Vero is one application among the eleven this app bills for, so a Vero lockup would misstate the scope.

No suite lockup exists in the asset set. The type treatment is carried over from the Vero one unchanged — display face at 30px for the name, first letter in brand orange, 11px uppercase and tracked for the qualifier. **Flagged:** this is a faithful extension, not approved artwork; the header component accepts a wordmark swap without other changes.

The suite name is roughly three times the width of a single product name. The header therefore steps the wordmark from 30px to 22px below 1280px and drops the user email at the same breakpoint, so the page never scrolls horizontally. 1024px is the supported floor.

---

## 6. Screens

### 6.1 Dashboard — Admin only

KPI tiles across the top: total billed, documents processed, active billable projects, and period-over-period change.

**Period selector: a single year, or All time.** All time aggregates the platform's entire history and reframes the whole page rather than only swapping numbers:

- Tile labels change from "Billed in 2026" to "Billed all time" — the two are not interchangeable phrasings of the same figure.
- The change tile switches from month-over-month to **year-over-year**, comparing the two most recent **complete** years. The current year is partial, so comparing it would report a collapse in billing that has not happened.
- The trend chart re-buckets from twelve months to one point per year, and drops its prior-period series — across the whole history there is no earlier period to compare against, so the second series and the legend both disappear.
- The trend chart carries an explicit caveat that the current year is still in progress, naming the months covered. Without it, the final point reads as a downturn rather than as a month count.

The trend series carries its own x-axis labels so the chart never infers its bucket from array length.

Three charts:

- **Revenue trend** — monthly billed amount for the selected year, with prior-year comparison as a second series.
- **Top projects by spend** — ranked horizontal bars, so the handful of projects dominating the invoice are visible immediately.
- **App mix** — documents and dollars per application, paired. The application processing the most documents is frequently not the one billing the most; that gap is the point of the chart.

Year selector governs the whole page.

### 6.2 Projects table

The core legibility problem: 31 columns, no pagination, no column pinning, no summary.

**Approach: progressive columns.**

- **Default view** — seven summary columns: project name, workspace ID, matter number, environment, total billing count, total amount, year count. Plus a **12-month sparkline per row** giving each project's shape at a glance.
- **Monthly detail** — a segmented control switches between **Counts / Amounts / Both**. The wide view is 12 or 24 columns by choice rather than always 24. Most sessions care only about dollars.
- **Project name column is pinned** while months scroll horizontally.
- Column visibility and density are user-controlled and persisted to `localStorage`.
- Search filters on project name (matching today's `#project_search` behavior).
- Export to Excel and CSV are retained.

Test workspaces are a **filter on this table** (Admin only), not a second table. This deletes the defect in §10.1 by construction.

Clicking a project opens its detail screen.

### 6.3 Project detail

Header shows project name, workspace ID, matter number, environment, effective rate, and last-synced time.

Retains the per-app monthly usage table, with tier grouping preserved.

Three charts:

- **Monthly volume by application** — how the project's usage is distributed across apps and across the year.
- **Threshold proximity** — per application, how close accrued volume is to the point where billing begins. Answers "what is about to start costing money?"
- **Effective rate in context** — this project's rate against the portfolio distribution. Answers "is this project priced normally?"

Links to the project's billing rule.

### 6.4 Billing rule — write-once

The same question sequence as today, as a guided form with progressive disclosure:

1. Is this a billable workspace?
2. Are any applications excluded from billing?
3. Are the unit rate and threshold the same for all applications?
4. Per-application tier assignment (if rates differ)
5. Unit price and threshold per tier

**A live summary panel** shows exactly what will be charged as the form is filled in. Today there is no way to check the work before committing an irreversible rule; this is the single most important addition to this screen.

**Saving goes through a consequence-first confirmation dialog**, reusing the pattern from production's newer delete dialog:

> **Set billing rule for `<project>`?**
> This rule cannot be edited after saving.
> [Cancel] [Set Billing Rule]

**Once set, the screen renders as a read-only summary card** — not a form of disabled inputs, which is what makes the current version feel broken. It shows the rule, who set it, when, and a **"Request a Rule Change"** action opening a prefilled message to `AnalyticsInstitute@ankura.com` (the address already used in `BillController.BillingStatusJson`).

Validation mirrors `BillingStatusViewModel.Validate`: non-negative unit price; at least one application selected when exclusions are enabled.

---

## 7. Data contract and backend seam

All data access goes through `src/api/`. Types mirror the existing `AnalyzedTimeInfo` shape exactly (`PredictiveCodingNet/Models/PCStatusCheckModel.cs:163`):

```ts
interface AnalyzedTimeInfo {
  WorkspaceId: number;
  WorkspaceName: string;
  MatterNumber: string | null;
  ProdType: string;
  UnitPrice: number;
  JobName: string;
  TotalCount: number;
  TotalBillCount: number;
  TotalPrice: number;
  YearCount: number;
  JobUnitRate: number;
  JobThreshold: number;
  Counts: number[];   // length 12
  Money: number[];    // length 12
}
```

The eleven billable applications, from `GeneralModel.JobColumnNames`:

```
TextPredict, DeDupe, Thread, TextCluster, Expand, Explore,
Sentimize, Emoji, ImagePredict, ImageCluster, Footer
```

Endpoints mirrored from `BillController`:

| Mock function | Replaces |
|---|---|
| `getProjectsAnalyzedTime(year, env, isTest)` | `ProjectAnalyzedTimeJsonTable` / `TestAnalyzedTimeJsonTable` |
| `getProjectAnalyzedTime(workspaceId, year, env)` | `PCAnalyzedTimeJsonTable` |
| `getBillingRule(workspaceId, env)` | `BillingStatusViewModel` constructor |
| `saveBillingRule(workspaceId, rule, env)` | `UpdateRule` |
| `getBillingConnectionStatus()` | `BillingStatusJson` |

The mock implementation returns realistic synthetic data from these shapes. **Swapping to the real backend means replacing the fetch implementations in this directory and nothing else.**

The connection-status check is retained: production surfaces a warning when the billing sync is more than 65 minutes stale. This becomes a dismissible banner rather than a modal `bootbox.confirm`, which currently interrupts the user before they can read the page.

---

## 8. Charts

Charts follow one system across the app:

- A single categorical palette derived from the Vero blue and neutral ramps, verified for contrast and for distinguishability.
- **Color never carries meaning alone** — series are labelled directly or via legend plus shape/position.
- Currency formatted as whole dollars with thousands separators, matching today's display convention.
- Every chart has an accessible text alternative and its underlying data reachable in tabular form.
- Empty, loading, and error states for every chart — none of which exist in the current application.

---

## 9. Technical approach

```
Vite + React 18 + TypeScript
Tailwind CSS v4 — Vero tokens mapped into @theme
shadcn/ui primitives, restyled to Vero
TanStack Table — sorting, filtering, pinning, column visibility
Recharts — all charts
React Router
```

Builds to static assets. `dist/` deploys to IIS or any internal web server; no Node runtime required at serve time.

```
src/
  api/          # typed mock data layer — the backend seam
  components/
    chrome/     # header, nav, footer, environment switch
    ui/         # shadcn primitives, Vero-styled
    charts/     # chart components + shared palette/formatters
    table/      # projects table, column definitions
  routes/       # dashboard, projects, project detail, billing rule
  lib/          # formatters, role provider, storage
  styles/       # Vero tokens + Tailwind theme mapping
```

---

## 10. Legacy defects fixed by this work

**10.1 — Broken Test Workspaces table.** `AnalyzedTimeProjects.cshtml:556` renders headers copy-pasted from an unrelated view: "Review / Legal Related / Legal Type / Name / Organization / Title / Email / Address / Phone Number / Signature ID". The JavaScript binds entirely different columns (workspace name, ID, matter number, counts). The table has rendered incorrect headers in production. Fixed by making test workspaces a filter on the single projects table.

**10.2 — Duplicate `id="example"`.** The same file uses `id="example"` on two tables (lines 496 and 554), which is invalid HTML; only the first is initialized by DataTables. The second table is inert.

**10.3 — Permanently locked rate form.** `AnalyzedTimeRule.cshtml:82` disables every input once a rule is defined, with no edit path, no change-request path, and no explanation. Replaced by a read-only summary card with a change-request action.

**10.4 — No empty, loading, or error states.** AJAX failures currently `console.log` the error code and leave the table blank with no user-facing message. All three states are designed.

**10.5 — Accessibility.** The current views have no focus management, no ARIA on sortable headers, checkbox controls without labels, and color-only status conveyance. The rebuild targets WCAG 2.1 AA.

**10.6 — Four near-identical page sets.** Prod/Dev collapses to a switch; test/billable collapses to a filter. Four page sets become one, removing the copy-paste divergence that produced 10.1.

---

## 11. Open items and flags

1. **No suite logo lockup exists.** The header names the Legal Analytics Suite rather than Vero, since the app bills for the whole suite. Interim treatment described in §5.5. Needs brand.
2. **Dark theme is out of scope.** Every production screenshot supplied is the Light theme, so there is no reference to match. The theme toggle is **omitted rather than shown inert** — a visible control that does nothing reads as broken. Dark mode is additive later once a reference exists.
3. **Contrast defect in production Vero.** The "Light" toggle label sits in the rightmost band of the gradient where white text measures 4.41:1, and renders in light gray rather than white — likely under 4:1 today. Worth raising with the Vero team; not in scope here.
4. **Casing divergence.** This spec follows production's Title Case headings over the skill's documented sentence-case rule (§5.3). If the skill is the intended standard, Vero itself needs updating and this app should follow.
5. **The skill's bundled screenshots are stale.** `vero-design/uploads/*.png` show the pre-reskin application (flat gray Bootstrap chrome, circle logo) while `readme.md` describes them as showing the gradient header and current production styling. Anyone reading that skill will be misled. Worth correcting at the source.
