using System;
using System.Collections.Generic;
using System.Linq;
using Dapper;
using Billing.Models;
using Billing.Services;

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
                              has_exclude, singleRate, chat_unit_price, chat_period, privlog_unit_price,
                              vero_exception_reason, synced_on, created_by, created_on
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
                    PrivLogUnitPrice = row.privlog_unit_price,
                    VeroExceptionReason = row.vero_exception_reason,
                    SyncedOn = row.synced_on,
                    CreatedBy = row.created_by,
                    CreatedOn = row.created_on,
                };

                // Not gated on IsDefined: a workspace can have real app_tier/tier_info rows
                // from a rule that was set and later reset back to "undefined" (is_test
                // nulled out directly in the database without clearing the tier data it
                // left behind) — confirmed to happen in production. Skipping this query
                // for IsDefined == -1 would hide that leftover tier/rate data from every
                // reader of ProjectInfo, including the Project Detail breakdown table,
                // even though the data (and its billed history) is real. A workspace that
                // has genuinely never had a rule simply has no app_tier rows, so this is a
                // no-op for it either way.
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

                // A workspace with no rule set yet has no app_tier rows at all (the loop above
                // is a no-op), but the legacy offline job still bills it — at the org's
                // suggested-default rule (DefaultBillingRule, the same suggestion the Set
                // Billing Rule form shows), so there's always a real number for Finance
                // instead of nothing. Synthesize that same mapping here so every reader of
                // ProjectInfo (the Project Detail breakdown) sees it. A workspace with ANY
                // real app_tier rows — even just one, even if it's actually an "unlocked"
                // workspace's leftover data — keeps using that real data untouched instead:
                // recomputing it under this default could silently overwrite genuine
                // historical amounts billed under whatever real rule it used to have,
                // if a tier name happens to collide (e.g. its own old "Tier_1").
                if (tierRows.Count() == 0 && info.IsDefined == -1)
                {
                    // So GetMonthTierCountsForWorkspace pre-seeds Tier_1/2/3 from JobGroupList
                    // below instead of a single flat "Tier_0" that no longer matches anything
                    // this synthesizes.
                    info.SingleUnitRate = false;
                    foreach (var app in AppMetadata.Apps)
                    {
                        if (string.Equals(app, AppMetadata.Chat, StringComparison.OrdinalIgnoreCase))
                        {
                            info.JobGroupList[app] = "Chat";
                        }
                        else if (string.Equals(app, "PrivLog", StringComparison.OrdinalIgnoreCase))
                        {
                            // Routed to its own dedicated bucket/rate (privlog_unit_price),
                            // not DefaultBillingRule's literal "Tier_4" entry — same effective
                            // rate, one fewer code path to keep in sync. See that class's comment.
                            info.JobGroupList[app] = "PrivLog";
                        }
                        else if (DefaultBillingRule.Tiers.TryGetValue(app, out var tier))
                        {
                            info.JobGroupList[app] = tier;
                        }
                        else
                        {
                            // Default-excluded (TextCluster, Expand, Explore, Sentimize, Emoji,
                            // Footer), or DeDupe/Thread (never had rule-engine support at all,
                            // see AppMetadata's own comment) — not billed under this default.
                            info.ExcludeList[app] = true;
                        }
                    }
                    foreach (var tier in DefaultBillingRule.TierRates.Keys)
                    {
                        if (tier == "Tier_4") continue; // nothing maps here; see above
                        info.UnitRates[tier] = DefaultBillingRule.TierRates[tier];
                        info.Thresholds[tier] = 0;
                    }
                    info.UnitRates["Chat"] = info.ChatUnitPrice ?? 0m;
                    info.Thresholds["Chat"] = 0;
                    info.UnitRates["PrivLog"] = info.PrivLogUnitPrice ?? DefaultBillingRule.TierRates["Tier_4"];
                    info.Thresholds["PrivLog"] = 0;
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
