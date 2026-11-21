using System;
using System.Collections.Generic;
using System.Linq;

namespace Billing.Services
{
    // Single canonical list of billable app keys, replacing the two inconsistent lists
    // that existed in the legacy PredictiveCodingNet codebase (GeneralModel.JobColumnNames,
    // 14 entries, vs PCStatusCheckModel.JobColumnNames, 16 entries — the extra two, DeDupe
    // and Thread, are dead in the rule engine but still have historical columns in the
    // `billing` table). This is the superset, so no historical volume is hidden.
    public static class AppMetadata
    {
        public const string Chat = "Chat";

        public static readonly IReadOnlyList<string> Apps = new[]
        {
            "TextPredict", "DeDupe", "Thread", "TextCluster", "Expand", "Explore",
            "Sentimize", "Emoji", "ImagePredict", "ImageCluster", "Footer",
            "Privilege", "Mine", "ConstructionPredict", Chat, "PrivLog"
        };

        public static readonly IReadOnlyList<string> NonChatApps =
            Apps.Where(a => a != Chat).ToList();

        // GeneralModel.JobColumnNames — the roster the *rule engine* actually assigns
        // tiers to. DeDupe and Thread are historical `billing` table columns with no
        // rule-engine support (excluded here on purpose, per that class's own comment);
        // they still appear in `Apps` above so usage reporting doesn't hide their
        // historical volume, but a billing rule is never written for them.
        public static readonly IReadOnlyList<string> RuleEngineApps = new[]
        {
            "TextPredict", "TextCluster", "Expand", "Explore", "Sentimize", "Emoji",
            "ImagePredict", "ImageCluster", "Footer", "Privilege", "Mine",
            "ConstructionPredict", "PrivLog",
        };

        private static readonly Dictionary<string, string> DisplayNames = new Dictionary<string, string>
        {
            { Chat, "Vero" },
            { "Footer", "Detect" },
            { "PrivLog", "Privilege Narrator" },
        };

        public static string GetDisplayName(string appName)
        {
            if (appName != null && DisplayNames.TryGetValue(appName, out var display))
            {
                return display;
            }
            return appName;
        }

        public static bool IsKnownApp(string appName) => Apps.Contains(appName, StringComparer.OrdinalIgnoreCase);
    }

    // The org's suggested default billing rule for a workspace with no rule set yet —
    // shown on the Set Billing Rule form as a starting point (BillingRuleRepository.GetRule)
    // AND what the legacy offline job (PredictiveCodingNetJob's Billing.cs) actually bills a
    // never-configured workspace at automatically, so Finance always has a real number for
    // it instead of nothing. The two are hand-kept in sync — Billing.cs is a separate
    // codebase/deployment with no shared assembly, so a change here must be mirrored there
    // too (GetTierCountTable's isDefined == -1 branch).
    public static class DefaultBillingRule
    {
        // The exact suggestion BillingRuleRepository.GetRule shows on the Set Billing Rule
        // form. Consumers that bill automatically rather than show a form (ProjectRepository's
        // undefined-workspace synthesis, the legacy job) special-case PrivLog separately —
        // it already gets its own dedicated default rate (privlog_unit_price) through the
        // same mechanism used when a rule predates PrivLog entirely, so they route it to that
        // instead of the literal "Tier_4" entry here, even though the effective rate is the
        // same $1.00 either way.
        public static readonly IReadOnlyCollection<string> ExcludedApps = new[]
        {
            "TextCluster", "Expand", "Explore", "Sentimize", "Emoji", "Footer",
        };

        public static readonly IReadOnlyDictionary<string, string> Tiers = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            { "TextPredict", "Tier_1" },
            { "ImagePredict", "Tier_2" },
            { "ImageCluster", "Tier_2" },
            { "Privilege", "Tier_3" },
            { "Mine", "Tier_1" },
            { "ConstructionPredict", "Tier_1" },
            { "PrivLog", "Tier_4" },
        };

        public static readonly IReadOnlyDictionary<string, decimal> TierRates = new Dictionary<string, decimal>
        {
            { "Tier_1", 0.03m }, { "Tier_2", 0.05m }, { "Tier_3", 0.10m }, { "Tier_4", 1.00m },
        };
    }

    public static class EnvironmentSuffix
    {
        public static string ForEnvironment(string env)
        {
            if (string.Equals(env, "dev", StringComparison.OrdinalIgnoreCase))
            {
                return "_Dev";
            }
            return "";
        }
    }

    public static class RoleNames
    {
        public const string Admin = "Admin";
        public const string PM = "PM";
    }
}
