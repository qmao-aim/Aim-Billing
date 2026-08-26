using System.Configuration;
using System.Data.SqlClient;

namespace Billing.DataAccess
{
    public static class BillingDbConnectionFactory
    {
        // Only "US" is wired up today (see Web.config: BillingDb_US). Adding a region is a
        // config-only change (add a BillingDb_<REGION> connection string) until an actual
        // region-selection feature — an API parameter and a UI switcher — decides which
        // region code to pass in here; nothing currently calls this with anything but the
        // default.
        public static SqlConnection Create(string region = "US")
        {
            var name = $"BillingDb_{region}";
            var entry = ConfigurationManager.ConnectionStrings[name];
            if (entry == null)
            {
                throw new ConfigurationErrorsException($"No connection string named '{name}' in Web.config for region '{region}'.");
            }
            return new SqlConnection(entry.ConnectionString);
        }
    }
}
