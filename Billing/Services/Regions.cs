using System;
using System.Linq;

namespace Billing.Services
{
    // Region codes as used in Web.config's BillingDb_<REGION> connection string
    // naming convention (see BillingDbConnectionFactory) and as returned to the
    // frontend on every AnalyzedTimeInfo row (so a "Global" list can still say
    // which region each project actually belongs to).
    public static class Regions
    {
        public const string US = "US";
        public const string UK = "UK";
        public const string Global = "Global";

        public static readonly string[] All = { US, UK };

        // Accepts the client's lowercase query values ("us"/"uk"/"global") and
        // anything already canonically-cased; throws on anything else so a typo
        // fails loudly instead of silently defaulting to one region.
        public static string Normalize(string region)
        {
            if (string.Equals(region, "global", StringComparison.OrdinalIgnoreCase)) return Global;
            var match = All.FirstOrDefault(r => string.Equals(r, region, StringComparison.OrdinalIgnoreCase));
            if (match == null)
            {
                throw new ArgumentException($"Unknown region: '{region}'. Expected one of: Global, {string.Join(", ", All)}.");
            }
            return match;
        }

        // The concrete region(s) a query actually needs to hit — Global means
        // "all of them, merged by the caller", never a real connection string.
        public static string[] Resolve(string normalizedRegion)
        {
            return normalizedRegion == Global ? All : new[] { normalizedRegion };
        }
    }
}
