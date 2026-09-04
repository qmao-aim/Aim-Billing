using System.Web.Mvc;
using Billing.Filters;

namespace Billing
{
    public class FilterConfig
    {
        public static void RegisterGlobalFilters(GlobalFilterCollection filters)
        {
            filters.Add(new HandleErrorAttribute());
            filters.Add(new AuthorizeAttribute());
            filters.Add(new RoleGateFilter());
            filters.Add(new MustChangePasswordFilter());
        }
    }
}
