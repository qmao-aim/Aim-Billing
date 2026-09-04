using System;
using System.Collections.Generic;
using System.Linq;
using Dapper;
using Billing.Models;
using Billing.Services;

namespace Billing.DataAccess
{
    // Ports PredictiveCodingNet.Models.PCStatusCheckModel's monthly/tier read queries.
    // `year == null` implements the SPA's YearFilter 'all' by dropping the year predicate,
    // per the documented contract — for the monthly breakdown arrays specifically, 'all'
    // has no single 12-month cycle to show, so Counts/Money come back zeroed and the
    // lifetime totals (TotalCount/TotalPrice/TotalBillCount) carry the real numbers.
    //
    // `region` is "US" or "UK" for anything scoped to one workspace (a project lives in
    // exactly one region's database) — only the portfolio list (GetProjectsAnalyzedTimeMonthTable)
    // accepts "Global", by querying every region and merging.
    public class BillingReadRepository
    {
        private readonly ProjectRepository _projects = new ProjectRepository();

        public List<int> GetMonthTableForWorkspace(int workspaceId, int year, string fieldName, string region, string suffix)
        {
            AssertKnownColumn(fieldName);
            using (var conn = BillingDbConnectionFactory.Create(region))
            {
                var rows = conn.Query(
                    $@"SELECT [month] AS Month, [{fieldName}] AS Value FROM [dbo].[billing{suffix}]
                       WHERE workspaceId = @workspaceId AND year = @year",
                    new { workspaceId, year }).ToList();

                var counts = new List<int>(new int[12]);
                foreach (var row in rows)
                {
                    int month = row.Month;
                    if (month >= 1 && month <= 12)
                    {
                        counts[month - 1] = row.Value ?? 0;
                    }
                }
                return counts;
            }
        }

        public int GetTotalCountForWorkspace(int workspaceId, string fieldName, string region, string suffix)
        {
            AssertKnownColumn(fieldName);
            using (var conn = BillingDbConnectionFactory.Create(region))
            {
                return conn.QueryFirstOrDefault<int?>(
                    $@"SELECT sum([{fieldName}]) FROM [dbo].[billing{suffix}] WHERE workspaceId = @workspaceId",
                    new { workspaceId }) ?? 0;
            }
        }

        private static void AssertKnownColumn(string fieldName)
        {
            if (fieldName != "total_amount" && !AppMetadata.IsKnownApp(fieldName))
            {
                throw new ArgumentException($"Unknown billing column: {fieldName}");
            }
        }

        // tier -> month(0=lifetime, 1..12=that month of `year`) -> (count, amount)
        public Dictionary<string, Dictionary<int, (int Count, decimal Amount)>> GetMonthTierCountsForWorkspace(
            int workspaceId, int? year, ProjectInfo project, string region, string suffix)
        {
            var tiers = project.SingleUnitRate
                ? new[] { "Tier_0" }
                : project.JobGroupList.Values.Distinct().ToArray();

            var result = new Dictionary<string, Dictionary<int, (int, decimal)>>();
            foreach (var tier in tiers)
            {
                result[tier] = Enumerable.Range(0, 13).ToDictionary(m => m, m => (0, 0m));
            }
            if (result.Count == 0) return result;

            using (var conn = BillingDbConnectionFactory.Create(region))
            {
                var lifetime = conn.Query(
                    $@"SELECT [tier] AS Tier, sum([count]) AS Count, sum([amount]) AS Amount
                       FROM [dbo].[billing_tier{suffix}]
                       WHERE workspaceId = @workspaceId AND [tier] != 'Excluded' GROUP BY [tier]",
                    new { workspaceId });
                foreach (var row in lifetime)
                {
                    string tier = row.Tier;
                    if (!result.ContainsKey(tier)) result[tier] = Enumerable.Range(0, 13).ToDictionary(m => m, m => (0, 0m));
                    result[tier][0] = ((int)(row.Count ?? 0), (decimal)(row.Amount ?? 0m));
                }

                if (year.HasValue)
                {
                    var monthly = conn.Query(
                        $@"SELECT [month] AS Month, [tier] AS Tier, [count] AS Count, [amount] AS Amount
                           FROM [dbo].[billing_tier{suffix}]
                           WHERE workspaceId = @workspaceId AND [year] = @year AND [tier] != 'Excluded'",
                        new { workspaceId, year = year.Value });
                    foreach (var row in monthly)
                    {
                        string tier = row.Tier;
                        int month = row.Month;
                        if (!result.ContainsKey(tier)) result[tier] = Enumerable.Range(0, 13).ToDictionary(m => m, m => (0, 0m));
                        if (month >= 1 && month <= 12)
                        {
                            result[tier][month] = ((int)(row.Count ?? 0), (decimal)(row.Amount ?? 0m));
                        }
                    }
                }
            }
            return result;
        }

        // workspaceId -> month(1..12) -> (count, amount) summed across all tiers, for EVERY
        // workspace in one batched query — used by the portfolio list (GetProjectsForRegion).
        // Replaces what used to be a query per workspace with billing activity; with ~700
        // projects in the US region alone, that loop was the dominant cost of loading the
        // Projects page.
        private Dictionary<int, Dictionary<int, (int Count, decimal Amount)>> GetMonthTierTableForAllWorkspaces(int year, string region, string suffix)
        {
            using (var conn = BillingDbConnectionFactory.Create(region))
            {
                var rows = conn.Query(
                    $@"SELECT [workspaceId] AS WorkspaceId, [month] AS Month, sum([count]) AS Count, sum([amount]) AS Amount
                       FROM [dbo].[billing_tier{suffix}] WHERE [year] = @year
                       GROUP BY [workspaceId], [month]",
                    new { year });

                var result = new Dictionary<int, Dictionary<int, (int, decimal)>>();
                foreach (var row in rows)
                {
                    int workspaceId = row.WorkspaceId;
                    int month = row.Month;
                    if (month < 1 || month > 12) continue;

                    if (!result.TryGetValue(workspaceId, out var monthly))
                    {
                        monthly = Enumerable.Range(1, 12).ToDictionary(m => m, m => (0, 0m));
                        result[workspaceId] = monthly;
                    }
                    monthly[month] = ((int)(row.Count ?? 0), (decimal)(row.Amount ?? 0m));
                }
                return result;
            }
        }

        // Public entry point: `region` may be "Global" here (the only place it's allowed to
        // be), meaning "every region's projects, merged into one list with one combined Total".
        public List<AnalyzedTimeInfo> GetProjectsAnalyzedTimeMonthTable(int? year, bool includeTest, string region, string suffix)
        {
            var rows = new List<AnalyzedTimeInfo>();
            foreach (var oneRegion in Regions.Resolve(region))
            {
                rows.AddRange(GetProjectsForRegion(year, includeTest, oneRegion, suffix));
            }

            if (rows.Count > 1)
            {
                rows.Add(new AnalyzedTimeInfo
                {
                    Region = region,
                    WorkspaceId = -1,
                    WorkspaceName = "Total",
                    JobName = "",
                    TotalCount = rows.Sum(r => r.TotalCount),
                    TotalBillCount = rows.Sum(r => r.TotalBillCount),
                    TotalPrice = rows.Sum(r => r.TotalPrice),
                    YearCount = rows.Sum(r => r.YearCount),
                    JobUnitRate = -1,
                    Counts = Enumerable.Range(0, 12).Select(i => rows.Sum(r => r.Counts[i])).ToList(),
                    Money = Enumerable.Range(0, 12).Select(i => rows.Sum(r => r.Money[i])).ToList(),
                });
            }
            return rows;
        }

        // One region's project rows, no Total row — the public method above owns combining
        // regions and computing a single Total across whatever it gathered.
        private List<AnalyzedTimeInfo> GetProjectsForRegion(int? year, bool includeTest, string region, string suffix)
        {
            var workspaces = _projects.GetProjectsInfo(false, region, suffix);
            if (includeTest)
            {
                workspaces.AddRange(_projects.GetProjectsInfo(true, region, suffix));
            }

            // One batched query for every workspace's monthly breakdown, instead of a query
            // per workspace with billing activity — see GetMonthTierTableForAllWorkspaces.
            var monthlyByWorkspace = year.HasValue
                ? GetMonthTierTableForAllWorkspaces(year.Value, region, suffix)
                : null;

            var rows = new List<AnalyzedTimeInfo>();
            foreach (var ws in workspaces)
            {
                var counts = new List<int>(new int[12]);
                var money = new List<decimal>(new decimal[12]);
                int yearCount = ws.TierTotalCount;

                if (ws.TierTotalCount > 0 && year.HasValue)
                {
                    // A workspace can be absent from the batch (no billing_tier rows in this
                    // specific year, even though it has lifetime activity from other years) —
                    // counts/money then keep their zero defaults above, matching what the old
                    // per-workspace call would have returned for the same case.
                    if (monthlyByWorkspace.TryGetValue(ws.WorkspaceId, out var monthTable))
                    {
                        counts = Enumerable.Range(1, 12).Select(m => monthTable[m].Count).ToList();
                        money = Enumerable.Range(1, 12).Select(m => monthTable[m].Amount).ToList();
                    }
                    yearCount = counts.Sum();
                }

                rows.Add(new AnalyzedTimeInfo
                {
                    Region = region,
                    WorkspaceId = ws.WorkspaceId,
                    WorkspaceName = ws.Name,
                    MatterNumber = ws.MatterNumber,
                    ProdType = ws.ProdInfo,
                    UnitPrice = ws.UnitPrice,
                    JobName = "",
                    TotalCount = ws.TierTotalCount,
                    TotalBillCount = ws.TierTotalCount,
                    TotalPrice = ws.TierTotalPrice,
                    YearCount = yearCount,
                    JobUnitRate = -1,
                    JobThreshold = 0,
                    Counts = counts,
                    Money = money,
                });
            }
            return rows;
        }

        // A single project, so `region` must be a real region here — never "Global".
        public List<AnalyzedTimeInfo> GetAnalyzedTimeMonthTable(int workspaceId, int? year, string region, string suffix)
        {
            var project = _projects.GetProjectInfo(workspaceId, region, suffix);
            if (project == null) return new List<AnalyzedTimeInfo>();

            var appRows = new Dictionary<string, AnalyzedTimeInfo>();
            foreach (var app in AppMetadata.Apps)
            {
                var monthCounts = year.HasValue
                    ? GetMonthTableForWorkspace(workspaceId, year.Value, app, region, suffix)
                    : new List<int>(new int[12]);
                int totalCount = GetTotalCountForWorkspace(workspaceId, app, region, suffix);

                // Raw key, not the display name (AppMetadata.GetDisplayName) — this
                // has to match BillingRule.jobExcludeList/jobGroupList's keys, which
                // are the raw app_tier names. The frontend maps to a display label
                // (APP_LABELS in types.ts) only at the point of rendering.
                var row = AnalyzedTimeInfo.WithUntrackedMoney();
                row.Region = region;
                row.WorkspaceId = workspaceId;
                row.JobName = app;
                row.IsAppRow = true;
                row.TotalCount = totalCount;
                row.Counts = monthCounts;
                row.YearCount = monthCounts.Sum();
                row.JobUnitRate = -1;
                row.JobThreshold = 0;
                appRows[app] = row;
            }

            // Grouped display order matching legacy's GetAnalyzedTimeMonthTable: an
            // "All Tiers" header (when more than one tier is in play), then each tier's
            // subtotal row immediately followed by its member apps, then an "Excluded
            // Tier" header followed by explicitly-excluded apps and any app that was
            // never assigned a tier at all (e.g. DeDupe/Thread, which the rule engine
            // never manages) — legacy's "undefined jobs, such as detect" case.
            var groupedRows = new List<AnalyzedTimeInfo>();
            // Only the genuine per-tier rows — excludes the "All Tiers"/"Excluded Tier"
            // synthetic headers, which would otherwise double-count when summing money
            // for the "All applications" row below.
            var tierMoneyRows = new List<AnalyzedTimeInfo>();
            var placedApps = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

            if (project.IsDefined != -1)
            {
                var tierCounts = GetMonthTierCountsForWorkspace(workspaceId, year, project, region, suffix);
                // Vero/Chat's dedicated tier is sorted after every generic tier (but still
                // before the "Excluded Tier" bucket below) rather than wherever it happens
                // to fall alphabetically — it's a different kind of billing (period-based,
                // not threshold-based) and reads better grouped apart from Tier_0..Tier_N.
                var tiers = tierCounts.Keys
                    .OrderBy(t => t.Equals("Chat", StringComparison.OrdinalIgnoreCase) ? 1 : 0)
                    .ThenBy(t => t, StringComparer.OrdinalIgnoreCase)
                    .ToList();

                if (tiers.Count > 1)
                {
                    groupedRows.Add(BuildTierRow(workspaceId, "All Tiers", tierCounts.Values, -1, 0));
                }
                foreach (var tier in tiers)
                {
                    decimal rate = project.UnitRates.TryGetValue(tier, out var r) ? r : 0m;
                    int threshold = project.Thresholds.TryGetValue(tier, out var th) ? th : 0;
                    var tierRow = BuildTierRow(workspaceId, tier, new[] { tierCounts[tier] }, rate, threshold);
                    groupedRows.Add(tierRow);
                    tierMoneyRows.Add(tierRow);

                    foreach (var app in appRows.Keys.ToList())
                    {
                        if (project.JobGroupList.TryGetValue(app, out var appTier) &&
                            string.Equals(appTier, tier, StringComparison.OrdinalIgnoreCase))
                        {
                            appRows[app].JobUnitRate = rate;
                            appRows[app].JobThreshold = threshold;
                            groupedRows.Add(appRows[app]);
                            placedApps.Add(app);
                        }
                    }
                }

                var leftoverApps = appRows.Keys.Where(a => !placedApps.Contains(a)).ToList();
                if (leftoverApps.Count > 0)
                {
                    groupedRows.Add(BuildTierRow(workspaceId, "Excluded Tier", new Dictionary<int, (int, decimal)>[0], 0, 0));
                    foreach (var app in leftoverApps)
                    {
                        appRows[app].JobUnitRate = 0;
                        appRows[app].JobThreshold = 0;
                        groupedRows.Add(appRows[app]);
                    }
                }
            }

            var allAppsRow = new AnalyzedTimeInfo
            {
                Region = region,
                WorkspaceId = workspaceId,
                WorkspaceName = project.Name,
                MatterNumber = project.MatterNumber,
                ProdType = project.ProdInfo,
                UnitPrice = project.UnitPrice,
                JobName = "All applications",
                TotalCount = appRows.Values.Sum(r => r.TotalCount),
                TotalBillCount = project.TierTotalCount,
                TotalPrice = project.TierTotalPrice,
                JobUnitRate = -1,
                JobThreshold = 0,
                Counts = Enumerable.Range(0, 12).Select(i => appRows.Values.Sum(r => r.Counts[i])).ToList(),
                Money = tierMoneyRows.Count == 0
                    ? new List<decimal>(new decimal[12])
                    : Enumerable.Range(0, 12).Select(i => tierMoneyRows.Sum(r => r.Money[i])).ToList(),
            };
            allAppsRow.YearCount = allAppsRow.Counts.Sum();

            // "All applications" first, then the tier-grouped breakdown (tier header
            // rows interleaved with their member apps, matching legacy's on-screen
            // grouping) — or, when no rule is defined yet, the raw per-app rows with
            // no tier framing at all, since there's nothing to group by.
            var result = new List<AnalyzedTimeInfo> { allAppsRow };
            result.AddRange(project.IsDefined != -1 ? groupedRows : (IEnumerable<AnalyzedTimeInfo>)appRows.Values);
            return result;
        }

        private AnalyzedTimeInfo BuildTierRow(
            int workspaceId, string tierName, IEnumerable<Dictionary<int, (int Count, decimal Amount)>> tierMonthSets,
            decimal rate, int threshold)
        {
            var counts = new List<int>(new int[12]);
            var money = new List<decimal>(new decimal[12]);
            int totalCount = 0;
            decimal totalPrice = 0m;

            foreach (var months in tierMonthSets)
            {
                if (months.TryGetValue(0, out var lifetime))
                {
                    totalCount += lifetime.Count;
                    totalPrice += lifetime.Amount;
                }
                for (int m = 1; m <= 12; m++)
                {
                    if (months.TryGetValue(m, out var mv))
                    {
                        counts[m - 1] += mv.Count;
                        money[m - 1] += mv.Amount;
                    }
                }
            }

            return new AnalyzedTimeInfo
            {
                WorkspaceId = workspaceId,
                JobName = tierName,
                TotalCount = totalCount,
                TotalBillCount = totalCount,
                TotalPrice = totalPrice,
                YearCount = counts.Sum(),
                JobUnitRate = rate,
                JobThreshold = threshold,
                Counts = counts,
                Money = money,
            };
        }
    }
}
