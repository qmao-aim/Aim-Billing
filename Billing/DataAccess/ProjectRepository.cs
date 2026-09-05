using System;
using System.Collections.Generic;
using System.Linq;
using Dapper;
using Billing.Models;

namespace Billing.DataAccess
{
    // Ports PredictiveCodingNet.Models.PCStatusCheckModel's project-level reads
    // (GetProjectInfo, GetProjectsInfo, GetProjectTierCountAndPrice, GetLatestSyncedTime)
    // against the central Billing database for a given region, parameterized instead
    // of string-concatenated.
    public class ProjectRepository
    {
        public ProjectInfo GetProjectInfo(int workspaceId, string region, string suffix)
        {
            using (var conn = BillingDbConnectionFactory.Create(region))
            {
                var row = conn.QueryFirstOrDefault(
                    $@"SELECT workspaceId, name, matter_number, prod_info, unit_price, unit_threshold, is_test,
                              has_exclude, singleRate, chat_unit_price, chat_period, vero_exception_reason, synced_on,
                              created_by, created_on
                       FROM [dbo].[project{suffix}] WHERE [workspaceId] = @workspaceId",
                    new { workspaceId });

                if (row == null) return null;

                var info = new ProjectInfo
                {
                    Region = region,
                    WorkspaceId = workspaceId,
                    Name = row.name,
                    MatterNumber = row.matter_number,
                    ProdInfo = row.prod_info,
                    UnitPrice = row.unit_price ?? 0m,
                    UnitThreshold = row.unit_threshold ?? 0,
                    IsDefined = row.is_test == null ? -1 : ((bool)row.is_test ? 1 : 0),
                    HasExclude = row.has_exclude ?? false,
                    SingleUnitRate = row.singleRate ?? true,
                    ChatUnitPrice = row.chat_unit_price,
                    ChatPeriod = row.chat_period,
                    VeroExceptionReason = row.vero_exception_reason,
                    SyncedOn = row.synced_on,
                    CreatedBy = row.created_by,
                    CreatedOn = row.created_on,
                };

                if (info.IsDefined != -1)
                {
                    var tierRows = conn.Query(
                        $@"SELECT a.[app] AS App, a.[tier] AS Tier, b.[price] AS Price, b.[threshold] AS Threshold
                           FROM [dbo].[app_tier{suffix}] a
                           LEFT JOIN [dbo].[tier_info{suffix}] b
                             ON a.workspaceId = b.workspaceId AND a.tier = b.tier
                           WHERE a.[workspaceId] = @workspaceId",
                        new { workspaceId });

                    foreach (var t in tierRows)
                    {
                        string app = t.App;
                        string tier = t.Tier;
                        if (string.Equals(tier, "Excluded", StringComparison.OrdinalIgnoreCase))
                        {
                            info.ExcludeList[app] = true;
                            continue;
                        }
                        info.JobGroupList[app] = tier;
                        if (!info.UnitRates.ContainsKey(tier))
                        {
                            decimal rate = t.Price ?? (string.Equals(tier, "Chat", StringComparison.OrdinalIgnoreCase)
                                ? (info.ChatUnitPrice ?? 0m) : 0m);
                            info.UnitRates[tier] = rate;
                            info.Thresholds[tier] = t.Threshold ?? 0;
                        }
                    }
                }

                var tierTotal = conn.QueryFirstOrDefault(
                    $@"SELECT sum([count]) AS Count, sum([amount]) AS Amount
                       FROM [dbo].[billing_tier{suffix}] WHERE [workspaceId] = @workspaceId",
                    new { workspaceId });
                info.TierTotalCount = tierTotal?.Count ?? 0;
                info.TierTotalPrice = tierTotal?.Amount ?? 0m;

                return info;
            }
        }

        public List<ProjectInfo> GetProjectsInfo(bool isTestProject, string region, string suffix)
        {
            using (var conn = BillingDbConnectionFactory.Create(region))
            {
                string testFilter = isTestProject
                    ? "[is_test] = 1"
                    : "([is_test] IS NULL OR [is_test] = 0)";

                var rows = conn.Query(
                    $@"SELECT workspaceId, name, matter_number, prod_info, unit_price, is_test, synced_on
                       FROM [dbo].[project{suffix}] WHERE workspaceId > 0 AND {testFilter}").ToList();

                // One aggregate query for every workspace's lifetime tier total, instead of
                // the query-per-workspace loop this used to run — with ~700 projects in the
                // US region alone, that loop was the dominant cost of loading this page.
                var tierTotals = conn.Query(
                    $@"SELECT [workspaceId] AS WorkspaceId, sum([count]) AS Count, sum([amount]) AS Amount
                       FROM [dbo].[billing_tier{suffix}] GROUP BY [workspaceId]")
                    .ToDictionary(r => (int)r.WorkspaceId, r => ((int)(r.Count ?? 0), (decimal)(r.Amount ?? 0m)));

                var result = new List<ProjectInfo>();
                foreach (var row in rows)
                {
                    int workspaceId = row.workspaceId;
                    var info = new ProjectInfo
                    {
                        Region = region,
                        WorkspaceId = workspaceId,
                        Name = row.name,
                        MatterNumber = row.matter_number,
                        ProdInfo = row.prod_info,
                        UnitPrice = row.unit_price ?? 0m,
                        IsDefined = row.is_test == null ? -1 : ((bool)row.is_test ? 1 : 0),
                        SyncedOn = row.synced_on,
                    };

                    var tierTotal = tierTotals.TryGetValue(workspaceId, out var t) ? t : (0, 0m);
                    info.TierTotalCount = tierTotal.Item1;
                    info.TierTotalPrice = tierTotal.Item2;

                    result.Add(info);
                }
                return result;
            }
        }

        // Legacy PCStatusCheckModel.GetLatestSyncedTime always reads the prod `project`
        // table regardless of the suffix argument passed in — an apparent oversight, not
        // a deliberate business rule (unlike the threshold logic). Fixed here so Dev's
        // connection status reflects Dev sync activity.
        public DateTime GetLatestSyncedTime(string region, string suffix)
        {
            using (var conn = BillingDbConnectionFactory.Create(region))
            {
                var value = conn.QueryFirstOrDefault<DateTime?>(
                    $"SELECT max([synced_on]) FROM [dbo].[project{suffix}]");
                return value ?? new DateTime(2019, 1, 1);
            }
        }
    }
}
