using System;
using System.Linq;
using Dapper;
using Billing.Models;
using Billing.Services;

namespace Billing.DataAccess
{
    // Ports PredictiveCodingNet.ViewModels.BillingStatusViewModel's read/write path
    // (GetRuleFromDB/GetTierRuleFromDB/IsDefined/UpdateRule/DeleteRules), parameterized
    // and wrapped in a transaction (legacy runs the update + tier inserts as separate,
    // unguarded ExecuteNonQuery calls with no transaction).
    public class BillingRuleRepository
    {
        private readonly ProjectRepository _projects = new ProjectRepository();

        public BillingRule GetRule(int workspaceId, string suffix)
        {
            var project = _projects.GetProjectInfo(workspaceId, suffix);
            if (project == null) return null;

            // For a project with no rule yet, ProjectRepository leaves the tier maps
            // empty (there's nothing in app_tier/tier_info to read). The rule-editing
            // form needs a sensible starting point, not empty maps — every app starts
            // unassigned/in the default tier, matching the write path's own "Tier_0"
            // default in BillingRuleRepository.SaveRule.
            var jobExcludeList = project.ExcludeList;
            var jobGroupList = project.JobGroupList;
            if (project.IsDefined == -1)
            {
                jobExcludeList = AppMetadata.RuleEngineApps.ToDictionary(a => a, _ => false);
                jobGroupList = AppMetadata.RuleEngineApps.ToDictionary(a => a, _ => "Tier_1");
            }

            return new BillingRule
            {
                WorkspaceId = workspaceId,
                WorkspaceName = project.Name,
                IsDefined = project.IsDefined,
                IsTest = project.IsDefined == 1,
                IsAppExcluded = project.HasExclude,
                SameUnitPrice = project.SingleUnitRate,
                UnitPrice = project.UnitPrice,
                Threshold = project.UnitThreshold,
                JobExcludeList = jobExcludeList,
                JobGroupList = jobGroupList,
                UnitPrices = project.UnitRates,
                ThresholdValues = project.Thresholds,
                CreatedBy = project.CreatedBy,
                CreatedOn = project.CreatedOn,
            };
        }

        public SaveRuleResult SaveRule(int workspaceId, string suffix, BillingRule rule, string savedByEmail)
        {
            var existing = _projects.GetProjectInfo(workspaceId, suffix);
            if (existing == null) return SaveRuleResult.Failure("Project not found.");
            if (existing.IsDefined != -1)
            {
                return SaveRuleResult.Failure("A billing rule is already set for this project and cannot be replaced.");
            }

            if (!rule.IsTest)
            {
                if (rule.SameUnitPrice && rule.UnitPrice < 0)
                {
                    return SaveRuleResult.Failure("Unit price must be non-negative.");
                }
                if (rule.Threshold < 0)
                {
                    return SaveRuleResult.Failure("Threshold must be non-negative.");
                }
                if (rule.IsAppExcluded && !rule.JobExcludeList.Values.Any(v => v))
                {
                    return SaveRuleResult.Failure("At least one application must be excluded.");
                }
                if (!rule.SameUnitPrice)
                {
                    var usedTiers = rule.JobGroupList.Values.Distinct();
                    foreach (var tier in usedTiers)
                    {
                        if (!rule.UnitPrices.TryGetValue(tier, out var price) || price < 0)
                        {
                            return SaveRuleResult.Failure($"Unit price for {tier} must be non-negative.");
                        }
                        if (!rule.ThresholdValues.TryGetValue(tier, out var threshold) || threshold < 0)
                        {
                            return SaveRuleResult.Failure($"Threshold for {tier} must be non-negative.");
                        }
                    }
                }
            }

            using (var conn = BillingDbConnectionFactory.Create())
            {
                conn.Open();
                using (var tx = conn.BeginTransaction())
                {
                    try
                    {
                        conn.Execute($"DELETE FROM [dbo].[app_tier{suffix}] WHERE [workspaceId] = @workspaceId",
                            new { workspaceId }, tx);
                        conn.Execute($"DELETE FROM [dbo].[tier_info{suffix}] WHERE [workspaceId] = @workspaceId",
                            new { workspaceId }, tx);
                        conn.Execute($"DELETE FROM [dbo].[billing_tier{suffix}] WHERE [workspaceId] = @workspaceId",
                            new { workspaceId }, tx);

                        if (rule.IsTest)
                        {
                            conn.Execute(
                                $@"UPDATE [dbo].[project{suffix}] SET [is_test] = 1, [singleRate] = 1,
                                   [has_exclude] = 0, [unit_price] = 0.00, [unit_threshold] = 0,
                                   [created_by] = @savedByEmail, [created_on] = GETUTCDATE()
                                   WHERE [workspaceId] = @workspaceId",
                                new { workspaceId, savedByEmail }, tx);
                        }
                        else
                        {
                            conn.Execute(
                                $@"UPDATE [dbo].[project{suffix}] SET [is_test] = 0, [singleRate] = @sameUnitPrice,
                                   [has_exclude] = @isAppExcluded, [unit_price] = @unitPrice, [unit_threshold] = @threshold,
                                   [created_by] = @savedByEmail, [created_on] = GETUTCDATE()
                                   WHERE [workspaceId] = @workspaceId",
                                new
                                {
                                    workspaceId,
                                    sameUnitPrice = rule.SameUnitPrice,
                                    isAppExcluded = rule.IsAppExcluded,
                                    unitPrice = rule.UnitPrice,
                                    threshold = rule.Threshold,
                                    savedByEmail,
                                }, tx);

                            var appTiers = new System.Collections.Generic.Dictionary<string, string>();
                            foreach (var app in AppMetadata.RuleEngineApps)
                            {
                                string tier;
                                if (rule.IsAppExcluded && rule.JobExcludeList.TryGetValue(app, out var excluded) && excluded)
                                {
                                    tier = "Excluded";
                                }
                                else if (!rule.SameUnitPrice && rule.JobGroupList.TryGetValue(app, out var group))
                                {
                                    tier = group;
                                }
                                else
                                {
                                    tier = "Tier_0";
                                }
                                appTiers[app] = tier;

                                conn.Execute(
                                    $@"INSERT INTO [dbo].[app_tier{suffix}] ([workspaceId], [app], [tier])
                                       VALUES (@workspaceId, @app, @tier)",
                                    new { workspaceId, app, tier }, tx);
                            }

                            foreach (var tier in appTiers.Values.Distinct().Where(t => t != "Excluded"))
                            {
                                decimal price = rule.SameUnitPrice ? rule.UnitPrice
                                    : (rule.UnitPrices.TryGetValue(tier, out var p) ? p : 0m);
                                int threshold = rule.SameUnitPrice ? rule.Threshold
                                    : (rule.ThresholdValues.TryGetValue(tier, out var t) ? t : 0);

                                conn.Execute(
                                    $@"INSERT INTO [dbo].[tier_info{suffix}] ([workspaceId], [tier], [price], [threshold])
                                       VALUES (@workspaceId, @tier, @price, @threshold)",
                                    new { workspaceId, tier, price, threshold }, tx);
                            }
                        }

                        // Chat/Vero always gets its own dedicated tier, whether the project is
                        // billable or test — its rate/period are configured separately, not
                        // through this rule (the SPA's BillingRule contract doesn't carry them).
                        conn.Execute(
                            $@"INSERT INTO [dbo].[app_tier{suffix}] ([workspaceId], [app], [tier])
                               VALUES (@workspaceId, 'Chat', 'Chat')",
                            new { workspaceId }, tx);

                        tx.Commit();
                    }
                    catch (Exception ex)
                    {
                        tx.Rollback();
                        return SaveRuleResult.Failure("Error: " + ex.Message);
                    }
                }
            }

            return SaveRuleResult.Success();
        }
    }
}
