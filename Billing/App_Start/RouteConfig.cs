using System.Web.Mvc;
using System.Web.Routing;

namespace Billing
{
    public class RouteConfig
    {
        public static void RegisterRoutes(RouteCollection routes)
        {
            routes.IgnoreRoute("{resource}.axd/{*pathInfo}");

            routes.MapRoute(
                name: "Account",
                url: "Account/{action}/{id}",
                defaults: new { controller = "Account", action = "Login", id = UrlParameter.Optional });

            routes.MapRoute(
                name: "Manage",
                url: "Manage/{action}/{id}",
                defaults: new { controller = "Manage", action = "Index", id = UrlParameter.Optional });

            routes.MapRoute(
                name: "Admin",
                url: "Admin/{action}/{id}",
                defaults: new { controller = "Admin", action = "Index", id = UrlParameter.Optional });

            // Everything else — the SPA shell itself, and every asset it references
            // (Vite's relative paths resolve against wherever this action serves the
            // shell from) — goes through HomeController.Index, which serves a real
            // asset file when the path matches one, or falls back to index.html so
            // the SPA's own HashRouter can handle in-app routes client-side.
            routes.MapRoute(
                name: "Default",
                url: "{*path}",
                defaults: new { controller = "Home", action = "Index", path = UrlParameter.Optional });
        }
    }
}
