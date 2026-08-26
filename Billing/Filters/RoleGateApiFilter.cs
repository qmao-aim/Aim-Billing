using System.Net;
using System.Net.Http;
using System.Web.Http.Controllers;
using System.Web.Http.Filters;
using Billing.Services;

namespace Billing.Filters
{
    // API equivalent of RoleGateFilter — a pending (authenticated, unroled) user gets a
    // 403 with a message the SPA can surface, instead of a server-side redirect.
    public class RoleGateApiFilter : AuthorizationFilterAttribute
    {
        public override void OnAuthorization(HttpActionContext actionContext)
        {
            var user = actionContext.RequestContext.Principal;
            if (user?.Identity == null || !user.Identity.IsAuthenticated) return;

            if (!user.IsInRole(RoleNames.Admin) && !user.IsInRole(RoleNames.PM))
            {
                actionContext.Response = actionContext.Request.CreateResponse(
                    HttpStatusCode.Forbidden,
                    new { message = "Your account is awaiting admin approval." });
            }
        }
    }
}
