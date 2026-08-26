using System;
using System.Web.Mvc;
using Billing.Services;

namespace Billing.Filters
{
    // Blocks an authenticated-but-unroled (pending) user from every MVC route except
    // Account (so they can still log off / see the pending page) and Manage (self-service
    // password change). [AuthorizeAttribute], registered ahead of this filter, already
    // handles the fully-unauthenticated case.
    public class RoleGateFilter : IAuthorizationFilter
    {
        private static readonly string[] AlwaysAllowedControllers = { "Account", "Manage" };

        public void OnAuthorization(AuthorizationContext filterContext)
        {
            var user = filterContext.HttpContext.User;
            if (user?.Identity == null || !user.Identity.IsAuthenticated) return;

            var controller = filterContext.RouteData.Values["controller"] as string;
            if (controller != null && Array.Exists(AlwaysAllowedControllers,
                c => string.Equals(c, controller, StringComparison.OrdinalIgnoreCase)))
            {
                return;
            }

            if (!user.IsInRole(RoleNames.Admin) && !user.IsInRole(RoleNames.PM))
            {
                filterContext.Result = new RedirectResult("~/Account/Pending");
            }
        }
    }
}
