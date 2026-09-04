using System;
using System.Security.Claims;
using System.Web.Mvc;

namespace Billing.Filters
{
    // Blocks a user whose Admin-set password is still temporary (see
    // ApplicationUser.MustChangePassword) from every MVC route except Account (so they
    // can still log off) and Manage (so they can actually reach the change-password
    // page). [AuthorizeAttribute] and RoleGateFilter, registered ahead of this filter,
    // already handle the unauthenticated and unroled/pending cases.
    public class MustChangePasswordFilter : IAuthorizationFilter
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

            if (user.Identity is ClaimsIdentity identity && identity.HasClaim("MustChangePassword", "true"))
            {
                filterContext.Result = new RedirectResult("~/Manage/ChangePassword");
            }
        }
    }
}
