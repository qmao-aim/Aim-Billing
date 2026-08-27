using System;
using System.Net;
using System.Net.Http;
using System.Web.Http;
using Billing.Services;

namespace Billing.Controllers.Api
{
    public abstract class BillingApiControllerBase : ApiController
    {
        protected string CurrentUserEmail => User.Identity.Name;
        protected bool IsAdmin => User.IsInRole(RoleNames.Admin);

        // The SPA hides the Prod/Dev switch and the test-workspaces filter for PMs, but
        // that's a UI convenience, not access control — every endpoint independently
        // rejects a hand-crafted env=dev request from a non-Admin.
        protected string SuffixFor(string env)
        {
            if (string.Equals(env, "dev", StringComparison.OrdinalIgnoreCase) && !IsAdmin)
            {
                throw new HttpResponseException(Request.CreateResponse(HttpStatusCode.Forbidden,
                    new { message = "Dev environment access is limited to Admins." }));
            }
            return EnvironmentSuffix.ForEnvironment(env);
        }

        // "Global"/"US"/"UK", case-insensitively — a 400 for a typo'd region beats an
        // unhandled exception turning into a 500.
        protected string NormalizeRegion(string region)
        {
            try
            {
                return Regions.Normalize(region);
            }
            catch (ArgumentException ex)
            {
                throw new HttpResponseException(Request.CreateResponse(HttpStatusCode.BadRequest,
                    new { message = ex.Message }));
            }
        }

        // A single project/rule always belongs to exactly one real region — "Global"
        // is only meaningful for the aggregate list/dashboard endpoints.
        protected string RequireSpecificRegion(string region)
        {
            var normalized = NormalizeRegion(region);
            if (normalized == Regions.Global)
            {
                throw new HttpResponseException(Request.CreateResponse(HttpStatusCode.BadRequest,
                    new { message = "This endpoint needs a specific region (US/UK), not Global." }));
            }
            return normalized;
        }
    }
}
