# Legal Analytics Suite — Billing

Standalone front end for the Ankura Legal Analytics Suite billing application,
reskinned to the Vero design system. Replaces the in-Relativity `Bill` views
(`PredictiveCodingNet/Views/Bill/`).

**This repository is the front end only.** All data comes from a typed mock
layer designed as a drop-in seam for the real backend — see
[Attaching the backend](#attaching-the-backend).

Design spec: [`docs/superpowers/specs/2026-08-12-billing-standalone-redesign-design.md`](../docs/superpowers/specs/2026-08-12-billing-standalone-redesign-design.md)

---

## Running it

```bash
npm install
npm run dev
```

| Command | Does |
|---|---|
| `npm run dev` | Dev server with hot reload |
| `npm run build` | Type-check then build to `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm run lint` | oxlint |

## Deploying

`npm run build` emits static files to `dist/`. Copy that folder to any web
server — IIS, nginx, a file share behind a reverse proxy. **No Node runtime is
required at serve time.**

Two choices make deployment undemanding:

- `base: './'` in `vite.config.ts`, so the app works from a subdirectory
  (`https://internal/billing/`) as well as from a domain root.
- **Hash routing** (`/#/projects/123`), so deep links resolve without an IIS
  URL-rewrite rule mapping every path back to `index.html`.

---

## Screens

| Route | Screen | Who |
|---|---|---|
| `/#/dashboard` | Portfolio KPIs, revenue trend, top projects, application mix | Admin |
| `/#/projects` | The portfolio table | Both |
| `/#/projects/:id` | Per-application usage, volume, thresholds, rate context | Both |
| `/#/projects/:id/rate` | Billing rule — write-once | Both |

`/` redirects by role: Admin to the dashboard, PM to the projects table.

### Roles

| Capability | PM | Admin |
|---|---|---|
| Projects table, project detail, set rules | ✓ | ✓ |
| Dashboard | — | ✓ |
| Prod/Dev switch | — | ✓ |
| Test workspaces filter | — | ✓ |

Admin-only controls are **hidden, not disabled** — a control a user can never
enable is a dead end, and hiding the environment switch from PMs removes the
risk of a rule being set against Dev by mistake.

While the auth seam is stubbed, a **Demo role** selector in the header switches
between the two so both can be reviewed. Remove it with the stub (below).

---

## Attaching the backend

Two files are the seam. Nothing else in the app touches data or identity.

### 1. `src/api/client.ts` — data

Every read and write goes through this file, and nothing else imports
`mock-data`. Replace each function body with an HTTP call; the return types
are already the shapes the server produces.

| Function | Existing endpoint |
|---|---|
| `getProjects` | `BillController.ProjectAnalyzedTimeJsonTable` / `TestAnalyzedTimeJsonTable` |
| `getProjectDetail` | `BillController.PCAnalyzedTimeJsonTable` |
| `getBillingRule` | `BillingStatusViewModel(workspaceId, id, suffix)` |
| `saveBillingRule` | `BillingStatusViewModel.UpdateRule` |
| `getConnectionStatus` | `BillController.BillingStatusJson` |
| `getPortfolioTotals` | new — derivable from the same tables |
| `getAppUsage` | new — derivable from the same tables |
| `getRateDistribution` | new — effective rate per billable project |

`src/api/types.ts` mirrors the server's `AnalyzedTimeInfo` field-for-field, in
the server's PascalCase, so JSON deserialises without a mapping layer.

The `Environment` type maps to the server's `suffix` parameter:
`'prod'` → `''`, `'dev'` → `'_Dev'`.

The `YearFilter` type is `number | 'all'`. **Implement `'all'` by dropping the
year predicate**, not by looping years server-side — these queries already
aggregate, so removing the `WHERE` clause is simpler and faster. One caveat
worth preserving: billing thresholds accrue *within* a calendar year, so an
all-time query must still split billable volume per year before summing, or
projects with thresholds will be over-billed in the total.

Once real calls are in place, delete `src/api/mock-data.ts`.

### 2. `src/lib/session.tsx` — identity

`SessionProvider` seeds role from `localStorage`. Replace the initial state
with the real identity call and delete `setRole` and the `RoleSwitch` in
`src/components/chrome/Header.tsx`. Every permission check reads `useSession()`
and needs no other change.

---

## Structure

```
src/
  api/          types.ts, client.ts (the seam), mock-data.ts (delete on cutover)
  components/
    chrome/     header, footer, sync banner, app shell
    ui/         button, card, badge, fields, dialog, states
    charts/     charts + the validated palette
    table/      TanStack feature registry and table furniture
  routes/       the four screens
  lib/          session, formatters, useAsync, export
  styles/       Vero tokens and self-hosted fonts
```

---

## Design notes worth knowing before you change things

**The chrome gradient is measured, not guessed.** Stops in
`src/styles/vero-tokens.css` were sampled from a production screenshot
(`#142129 → #2A5753 → #3D8476`). The 50% stop is required: a two-stop gradient
interpolates to `#295350` at centre where the real bar is `#2A5753`.

**White text on the gradient falls to 4.41:1 at the far right**, below WCAG AA
for normal text. Header controls stay clear of the final 40px and sit on solid
chips. Don't put bare text there.

**Teal appears nowhere in this app.** In Vero, teal is earned by the AI-search
mode; Billing has no AI surface. The only teal is the footer `Info` link.

**No chart uses more than two categorical series.** Vero's palette is
deliberately desaturated and cannot separate more — the per-application
breakdown is drawn as small multiples rather than eleven stacked colours. The
reasoning and the validator output are documented in
`src/components/charts/palette.ts`. Read it before adding a chart.

**Casing follows production**: Title Case page headings and buttons, sentence
case for ledes, body, and table content.

**Light theme only.** Every production screenshot available was the light
theme, so there was no reference to match dark against. The theme toggle is
omitted rather than shown inert. The token layer is structured so a dark block
can be added without touching components.

---

## Known gaps

- **No suite logo lockup exists.** The header reads "Ankura Legal Analytics
  Suite / Billing" — this app bills for every application in the suite, not
  for Vero alone. The type treatment is carried over from the Vero lockup
  (display face, first letter in brand orange, small tracked qualifier), but
  it is an extension, not approved artwork. `Wordmark` in `Header.tsx` accepts
  a swap without other changes.
- **The suite name is ~3x the width of a single product name**, so the header
  steps the wordmark from 30px down to 22px below 1280px and drops the user
  email, to keep the page from scrolling horizontally. 1024px is the floor.
- **"Export to Excel" emits CSV with a UTF-8 BOM**, which Excel opens natively.
  True `.xlsx` needs a workbook library; swap `src/lib/export.ts` alone.
- **No tests.** The app is presentation over a mock layer; the meaningful
  tests belong against the real API.
