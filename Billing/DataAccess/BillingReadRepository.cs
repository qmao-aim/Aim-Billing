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
    public class BillingReadRepository
    {
        private readonly ProjectRepository _projects = new ProjectRepository();

        public List<int> GetMonthTableForWorkspace(int workspaceId, int year, string fieldName, string suffix)
        {
            AssertKnownColumn(fieldName);
            using (var conn = BillingDbConnectionFactory.Create())
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

        public int GetTotalCountForWorkspace(int workspaceId, string fieldName, string suffix)
        {
            AssertKnownColumn(fieldName);
            using (var conn = BillingDbConnectionFactory.Create())
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
            int workspaceId, int? year, ProjectInfo project, string suffix)
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

            using (var conn = BillingDbConnectionFactory.Create())
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

        // month(1..12) -> (count, amount) summed across all tiers — used for the portfolio list.
        public Dictionary<int, (int Count, decimal Amount)> GetMonthTierTableForWorkspace(int workspaceId, int year, string suffix)
        {
            using (var conn = BillingDbConnectionFactory.Create())
            {
                var rows = conn.Query(
                    $@"SELECT [month] AS Month, sum([count]) AS Count, sum([amount]) AS Amount
                       FROM [dbo].[billing_tier{suffix}] WHERE workspaceId = @workspaceId AND year = @year
                       GROUP BY [month]",
                    new { workspaceId, year });

                var result = Enumerable.Range(1, 12).ToDictionary(m => m, m => (0, 0m));
                foreach (var row in rows)
                {
                    int month = row.Month;
                    if (month >= 1 && month <= 12)
                    {
                        result[month] = ((int)(row.Count ?? 0), (decimal)(row.Amount ?? 0m));
                    }
                }
                return result;
            }
        }

        public List<AnalyzedTimeInfo> GetProjectsAnalyzedTimeMonthTable(int? year, bool includeTest, string suffix)
        {
            var workspaces = _projects.GetProjectsInfo(false, suffix);
            if (includeTest)
            {
                workspaces.AddRange(_projects.GetProjectsInfo(true, suffix));
            }

            var rows = new List<AnalyzedTimeInfo>();
            foreach (var ws in workspaces)
            {
                var counts = new List<int>(new int[12]);
                var money = new List<decimal>(new decimal[12]);
                int yearCount = ws.TierTotalCount;

                if (ws.TierTotalCount > 0 && year.HasValue)
                {
                    var monthTable = GetMonthTierTableForWorkspace(ws.WorkspaceId, year.Value, suffix);
                    counts = Enumerable.Range(1, 12).Select(m => monthTable[m].Count).ToList();
                    money = Enumerable.Range(1, 12).Select(m => monthTable[m].Amount).ToList();
                    yearCount = counts.Sum();
                }

                rows.Add(new AnalyzedTimeInfo
                {
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

            if (rows.Count > 1)
            {
                rows.Add(new AnalyzedTimeInfo
                {
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

        public List<AnalyzedTimeInfo> GetAnalyzedTimeMonthTable(int workspaceId, int? year, string suffix)
        {
            var project = _projects.GetProjectInfo(workspaceId, suffix);
            if (project == null) return new List<AnalyzedTimeInfo>();

            var appRows = new Dictionary<string, AnalyzedTimeInfo>();
            foreach (var app in AppMetadata.Apps)
            {
                var monthCounts = year.HasValue
                    ? GetMonthTableForWorkspace(workspaceId, year.Value, app, suffix)
                    : new List<int>(new int[12]);
                int totalCount = GetTotalCountForWorkspace(workspaceId, app, suffix);

                var row = AnalyzedTimeInfo.WithUntrackedMoney();
                row.WorkspaceId = workspaceId;
                row.JobName = AppMetadata.GetDisplayName(app);
                row.TotalCount = totalCount;
                row.Counts = monthCounts;
                row.YearCount = monthCounts.Sum();
                row.JobUnitRate = -1;
                row.JobThreshold = 0;
                appRows[app] = row;
            }

            var otherRows = new List<AnalyzedTimeInfo>();
            // Only the genuine per-tier rows — excludes the "All Tiers"/"Excluded Tier"
            // synthetic headers, which would otherwise double-count when summing money
            // for the "All applications" row below.
            var tierMoneyRows = new List<AnalyzedTimeInfo>();

            if (project.IsDefined != -1)
            {
                var tierCounts = GetMonthTierCountsForWorkspace(workspaceId, year, project, suffix);
                var tiers = tierCounts.Keys.OrderBy(t => t).ToList();

                if (tiers.Count > 1)
                {
                    otherRows.Add(BuildTierRow(workspaceId, "All Tiers", tierCounts.Values, -1, 0));
                }
                foreach (var tier in tiers)
                {
                    decimal rate = project.UnitRates.TryGetValue(tier, out var r) ? r : 0m;
                    int threshold = project.Thresholds.TryGetValue(tier, out var th) ? th : 0;
                    var tierRow = BuildTierRow(workspaceId, tier, new[] { tierCounts[tier] }, rate, threshold);
                    otherRows.Add(tierRow);
                    tierMoneyRows.Add(tierRow);

                    foreach (var app in appRows.Keys.ToList())
                    {
                        if (project.JobGroupList.TryGetValue(app, out var appTier) &&
                            string.Equals(appTier, tier, StringComparison.OrdinalIgnoreCase))
                        {
                            appRows[app].JobUnitRate = rate;
                            appRows[app].JobThreshold = threshold;
                        }
                    }
                }

                if (project.ExcludeList.Values.Any(v => v))
                {
                    otherRows.Add(BuildTierRow(workspaceId, "Excluded Tier", new Dictionary<int, (int, decimal)>[0], 0, 0));
                    foreach (var app in appRows.Keys.ToList())
                    {
                        if (project.ExcludeList.TryGetValue(app, out var excluded) && excluded)
                        {
                            appRows[app].JobUnitRate = 0;
                            appRows[app].JobThreshold = 0;
                        }
                    }
                }
            }

            var allAppsRow = new AnalyzedTimeInfo
            {
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

            // The SPA's contract is exactly "All applications" + one row per real
            // application (README: "one row per application ... PLUS a synthetic
            // row") — the tier-summary rows built above (otherRows) are only used
            // internally, to compute allAppsRow's ground-truth money above; they
            // are not part of the wire shape and would otherwise show up as bogus
            // "applications" named "Tier_1"/"All Tiers"/"Excluded Tier" in the UI.
            var result = new List<AnalyzedTimeInfo> { allAppsRow };
            result.AddRange(appRows.Values);
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
