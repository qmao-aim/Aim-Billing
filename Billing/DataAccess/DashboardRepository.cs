using System;
using System.Collections.Generic;
using System.Linq;
using Dapper;
using Billing.Models;
using Billing.Services;

namespace Billing.DataAccess
{
    // New (no legacy equivalent): portfolio-level aggregates for the dashboard/app-usage/
    // rate-distribution screens. Dollar figures are read straight from billing_tier (the
    // offline job's already threshold-correct output) — never re-derived or apportioned
    // per-app, per the product decision that per-app dollar splits aren't invented.
    //
    // `region` may be "Global" here (unlike most repositories) — every public method
    // resolves it to the real region(s) via Regions.Resolve and merges per-region results.
    public class DashboardRepository
    {
        private readonly ProjectRepository _projects = new ProjectRepository();

        public List<AppUsage> GetAppUsage(int? year, string region, string suffix)
        {
            var perRegion = Regions.Resolve(region).Select(r => GetAppUsageForRegion(year, r, suffix)).ToList();
            return AppMetadata.Apps.Select(app => new AppUsage
            {
                App = app,
                Documents = perRegion.Sum(list => list.First(u => u.App == app).Documents),
            }).ToList();
        }

        private List<AppUsage> GetAppUsageForRegion(int? year, string region, string suffix)
        {
            var columns = string.Join(", ", AppMetadata.Apps.Select(a => $"SUM([{a}]) AS [{a}]"));
            using (var conn = BillingDbConnectionFactory.Create(region))
            {
                var row = conn.QueryFirstOrDefault(
                    $@"SELECT {columns} FROM [dbo].[billing{suffix}] b
                       INNER JOIN [dbo].[project{suffix}] p ON b.workspaceId = p.workspaceId
                       WHERE (p.[is_test] IS NULL OR p.[is_test] = 0)
                         AND (@year IS NULL OR b.[year] = @year)",
                    new { year });

                var dict = (IDictionary<string, object>)row;
                return AppMetadata.Apps.Select(app => new AppUsage
                {
                    App = app,
                    Documents = dict.TryGetValue(app, out var v) && v != null ? Convert.ToInt64(v) : 0L,
                }).ToList();
            }
        }

        public List<decimal> GetRateDistribution(string region, string suffix)
        {
            var rates = new List<decimal>();
            foreach (var oneRegion in Regions.Resolve(region))
            {
                var projects = _projects.GetProjectsInfo(false, oneRegion, suffix).Where(p => p.IsDefined == 0);
                rates.AddRange(projects.Select(p => p.TierTotalCount > 0 ? p.TierTotalPrice / p.TierTotalCount : p.UnitPrice));
            }
            rates.Sort();
            return rates;
        }

        public PortfolioTotals GetPortfolioTotals(int? year, string region, string suffix)
        {
            var raws = Regions.Resolve(region).Select(r => GetRawTotalsForRegion(year, r, suffix)).ToList();

            var mergedSeries = MergeSeries(raws.Select(r => r.Series));
            long totalDocs = raws.Sum(r => r.TotalDocuments);
            int activeProjects = raws.Sum(r => r.ActiveProjects);

            if (year.HasValue)
            {
                var mergedPrior = MergeSeries(raws.Select(r => r.PriorSeries));
                var (pct, label) = ComputeChange(mergedSeries, "Latest complete month vs. prior");
                return new PortfolioTotals
                {
                    TotalBilled = mergedSeries.Sum(p => p.Value),
                    TotalDocuments = totalDocs,
                    ActiveProjects = activeProjects,
                    Series = mergedSeries,
                    PriorSeries = mergedPrior,
                    SeriesLabel = year.Value.ToString(),
                    PriorSeriesLabel = (year.Value - 1).ToString(),
                    SeriesNote = null,
                    ChangePct = pct,
                    ChangeLabel = label,
                };
            }
            else
            {
                int currentYear = DateTime.UtcNow.Year;
                int monthsBilledThisYear = raws.SelectMany(r => r.BilledMonthsThisYear).Distinct().Count();
                string note = (monthsBilledThisYear > 0 && monthsBilledThisYear < 12)
                    ? $"{currentYear} is in progress — {monthsBilledThisYear} of 12 months billed so far."
                    : null;

                var completeYears = mergedSeries.Where(p => p.Label != currentYear.ToString()).ToList();
                var (pct, label) = ComputeChange(completeYears, "vs. prior complete year");

                return new PortfolioTotals
                {
                    TotalBilled = mergedSeries.Sum(p => p.Value),
                    TotalDocuments = totalDocs,
                    ActiveProjects = activeProjects,
                    Series = mergedSeries,
                    PriorSeries = null,
                    SeriesLabel = "Billed per year",
                    PriorSeriesLabel = null,
                    SeriesNote = note,
                    ChangePct = pct,
                    ChangeLabel = label,
                };
            }
        }

        private class RawRegionTotals
        {
            public List<SeriesPoint> Series;
            public List<SeriesPoint> PriorSeries;
            public long TotalDocuments;
            public int ActiveProjects;
            public List<int> BilledMonthsThisYear = new List<int>();
        }

        private RawRegionTotals GetRawTotalsForRegion(int? year, string region, string suffix)
        {
            using (var conn = BillingDbConnectionFactory.Create(region))
            {
                if (year.HasValue)
                {
                    var currentSeries = GetMonthlyBilledSeries(conn, year.Value, suffix);
                    var priorSeries = GetMonthlyBilledSeries(conn, year.Value - 1, suffix);
                    long totalDocs = conn.QueryFirstOrDefault<long?>(
                        $@"SELECT SUM(b.[total_amount]) FROM [dbo].[billing{suffix}] b
                           INNER JOIN [dbo].[project{suffix}] p ON b.workspaceId = p.workspaceId
                           WHERE (p.[is_test] IS NULL OR p.[is_test] = 0) AND b.[year] = @year",
                        new { year = year.Value }) ?? 0L;
                    int activeProjects = conn.QueryFirstOrDefault<int?>(
                        $@"SELECT COUNT(DISTINCT b.workspaceId) FROM [dbo].[billing{suffix}] b
                           INNER JOIN [dbo].[project{suffix}] p ON b.workspaceId = p.workspaceId
                           WHERE (p.[is_test] IS NULL OR p.[is_test] = 0) AND b.[year] = @year AND b.[total_amount] > 0",
                        new { year = year.Value }) ?? 0;

                    return new RawRegionTotals
                    {
                        Series = currentSeries,
                        PriorSeries = priorSeries,
                        TotalDocuments = totalDocs,
                        ActiveProjects = activeProjects,
                    };
                }
                else
                {
                    int currentYear = DateTime.UtcNow.Year;
                    const int firstYear = 2019;

                    var yearRows = conn.Query(
                        $@"SELECT bt.[year] AS Year, SUM(bt.[amount]) AS Amount
                           FROM [dbo].[billing_tier{suffix}] bt
                           INNER JOIN [dbo].[project{suffix}] p ON bt.workspaceId = p.workspaceId
                           WHERE (p.[is_test] IS NULL OR p.[is_test] = 0)
                           GROUP BY bt.[year]").ToDictionary(r => (int)r.Year, r => (decimal)(r.Amount ?? 0m));

                    var series = Enumerable.Range(firstYear, currentYear - firstYear + 1)
                        .Select(y => new SeriesPoint { Label = y.ToString(), Value = yearRows.TryGetValue(y, out var v) ? v : 0m })
                        .ToList();

                    long totalDocs = conn.QueryFirstOrDefault<long?>(
                        $@"SELECT SUM(b.[total_amount]) FROM [dbo].[billing{suffix}] b
                           INNER JOIN [dbo].[project{suffix}] p ON b.workspaceId = p.workspaceId
                           WHERE (p.[is_test] IS NULL OR p.[is_test] = 0)") ?? 0L;
                    int activeProjects = conn.QueryFirstOrDefault<int?>(
                        $@"SELECT COUNT(DISTINCT b.workspaceId) FROM [dbo].[billing{suffix}] b
                           INNER JOIN [dbo].[project{suffix}] p ON b.workspaceId = p.workspaceId
                           WHERE (p.[is_test] IS NULL OR p.[is_test] = 0) AND b.[total_amount] > 0") ?? 0;

                    var billedMonths = conn.Query<int>(
                        $@"SELECT DISTINCT bt.[month] FROM [dbo].[billing_tier{suffix}] bt
                           INNER JOIN [dbo].[project{suffix}] p ON bt.workspaceId = p.workspaceId
                           WHERE (p.[is_test] IS NULL OR p.[is_test] = 0) AND bt.[year] = @currentYear AND bt.[amount] > 0",
                        new { currentYear }).ToList();

                    return new RawRegionTotals
                    {
                        Series = series,
                        PriorSeries = null,
                        TotalDocuments = totalDocs,
                        ActiveProjects = activeProjects,
                        BilledMonthsThisYear = billedMonths,
                    };
                }
            }
        }

        // Sums matching-index points across however many regions were queried — every
        // region's series uses the same label set/order (months, or the fixed
        // firstYear..currentYear range), so summing by position is safe and avoids
        // needing to join on the label string.
        private static List<SeriesPoint> MergeSeries(IEnumerable<List<SeriesPoint>> serieses)
        {
            var list = serieses.Where(s => s != null).ToList();
            if (list.Count == 0) return null;
            int length = list[0].Count;
            return Enumerable.Range(0, length)
                .Select(i => new SeriesPoint { Label = list[0][i].Label, Value = list.Sum(s => s[i].Value) })
                .ToList();
        }

        private static List<SeriesPoint> GetMonthlyBilledSeries(System.Data.SqlClient.SqlConnection conn, int year, string suffix)
        {
            var monthNames = new[] { "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec" };
            var rows = conn.Query(
                $@"SELECT bt.[month] AS Month, SUM(bt.[amount]) AS Amount
                   FROM [dbo].[billing_tier{suffix}] bt
                   INNER JOIN [dbo].[project{suffix}] p ON bt.workspaceId = p.workspaceId
                   WHERE (p.[is_test] IS NULL OR p.[is_test] = 0) AND bt.[year] = @year
                   GROUP BY bt.[month]",
                new { year }).ToDictionary(r => (int)r.Month, r => (decimal)(r.Amount ?? 0m));

            return Enumerable.Range(1, 12)
                .Select(m => new SeriesPoint { Label = monthNames[m - 1], Value = rows.TryGetValue(m, out var v) ? v : 0m })
                .ToList();
        }

        private static (decimal Pct, string Label) ComputeChange(List<SeriesPoint> series, string label)
        {
            var withData = series.Where(p => p.Value != 0).ToList();
            if (withData.Count < 2) return (0m, label);
            var last = withData[withData.Count - 1];
            var prev = withData[withData.Count - 2];
            if (prev.Value == 0) return (0m, label);
            return (Math.Round((last.Value - prev.Value) / prev.Value * 100m, 1), label);
        }
    }
}
