using System.Configuration;
using Microsoft.AspNet.Identity;
using Microsoft.AspNet.Identity.EntityFramework;
using Billing.Models;

namespace Billing.Services
{
    // Runs once at app startup (Global.asax). Ensures the Admin/PM roles exist, and — if
    // a Web.config `InitialAdminEmail` app setting names a registered user — promotes them
    // to Admin. This is the one manual bootstrap step: since self-registration grants no
    // role, nobody could otherwise reach the admin screen that promotes everyone else.
    //
    // UserManager/RoleManager in this Identity version are async-only (no sync wrappers).
    // Application_Start itself can't be async, so this blocks on each call directly —
    // the standard, safe exception to "never block on async in ASP.NET": there is no
    // request pipeline (and therefore no captured SynchronizationContext) running yet
    // when this executes.
    public static class IdentitySeeder
    {
        public static void EnsureRolesAndInitialAdmin()
        {
            using (var db = new ApplicationDbContext())
            {
                var roleManager = new RoleManager<IdentityRole>(new RoleStore<IdentityRole>(db));
                foreach (var role in new[] { RoleNames.Admin, RoleNames.PM })
                {
                    if (!roleManager.RoleExistsAsync(role).GetAwaiter().GetResult())
                    {
                        roleManager.CreateAsync(new IdentityRole(role)).GetAwaiter().GetResult();
                    }
                }

                var initialAdminEmail = ConfigurationManager.AppSettings["InitialAdminEmail"];
                if (!string.IsNullOrWhiteSpace(initialAdminEmail))
                {
                    var userManager = new UserManager<ApplicationUser>(new UserStore<ApplicationUser>(db));
                    var user = userManager.FindByEmailAsync(initialAdminEmail).GetAwaiter().GetResult();
                    if (user != null && !userManager.IsInRoleAsync(user.Id, RoleNames.Admin).GetAwaiter().GetResult())
                    {
                        userManager.AddToRoleAsync(user.Id, RoleNames.Admin).GetAwaiter().GetResult();
                    }
                }
            }
        }
    }
}
