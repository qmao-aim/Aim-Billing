using System;

namespace Billing.Services
{
    public static class YearFilterParser
    {
        // null/missing or "all" -> null, which every repository method treats as
        // "drop the year predicate" per the SPA's YearFilter contract.
        public static int? Parse(string year)
        {
            if (string.IsNullOrEmpty(year) || string.Equals(year, "all", StringComparison.OrdinalIgnoreCase))
            {
                return null;
            }
            return int.Parse(year);
        }
    }
}
