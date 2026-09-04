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
