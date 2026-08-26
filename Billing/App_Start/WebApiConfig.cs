using System.Web.Http;
using Billing.Filters;

namespace Billing
{
    public static class WebApiConfig
    {
        public static void Register(HttpConfiguration config)
        {
            config.MapHttpAttributeRoutes();

            // Json.NET's default already leaves C# property names as-is (PascalCase) —
            // that's what AnalyzedTimeInfo relies on, to mirror the legacy server's
            // exact field names. Every other model (Models/ApiModels.cs, BillingRule)
            // has explicit [JsonProperty] camelCase overrides instead, so no global
            // contract resolver is needed here.

            config.Filters.Add(new System.Web.Http.AuthorizeAttribute());
            config.Filters.Add(new RoleGateApiFilter());
        }
    }
}
