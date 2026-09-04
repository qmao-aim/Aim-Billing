using System;
using System.Security.Claims;
using System.Threading.Tasks;
using Microsoft.AspNet.Identity;
using Microsoft.AspNet.Identity.EntityFramework;

namespace Billing.Models
{
    public class ApplicationUser : IdentityUser
    {
        public DateTime CreatedOn { get; set; } = DateTime.UtcNow;

        // Set together by AdminController.SetRole when a real role (Admin/PM) is
        // granted, and cleared when access is revoked back to "Pending" — this
        // reflects who approved the account's CURRENT access, not a history of
        // every change.
        public string ApprovedBy { get; set; }
        public DateTime? ApprovedOn { get; set; }

        // Set by AdminController.ResetPassword whenever an Admin sets a user's password
        // directly (there is no self-service "forgot password" — no SMTP in this app),
        // so the Admin-chosen password is only ever temporary: the user is forced to pick
        // their own on next login and the Admin never ends up knowing the password they
        // actually use. Cleared by ManageController.ChangePassword on success.
        public bool MustChangePassword { get; set; }

        public async Task<ClaimsIdentity> GenerateUserIdentityAsync(UserManager<ApplicationUser> manager)
        {
            var userIdentity = await manager.CreateIdentityAsync(this, DefaultAuthenticationTypes.ApplicationCookie);
            // Baked into the auth cookie at sign-in time rather than checked fresh from the
            // DB per request (matching how roles already work here) — MustChangePassword is
            // only meant to take effect starting the user's NEXT login anyway, and a stale
            // password's SecurityStamp gets invalidated by ResetPasswordAsync regardless, so
            // any existing session is already forced through a fresh sign-in before this can
            // go stale in practice.
            if (MustChangePassword)
            {
                userIdentity.AddClaim(new Claim("MustChangePassword", "true"));
            }
            return userIdentity;
        }
    }

    public class ApplicationDbContext : IdentityDbContext<ApplicationUser>
    {
        public ApplicationDbContext() : base("DefaultConnection", throwIfV1Schema: false)
        {
        }

        public static ApplicationDbContext Create()
        {
            return new ApplicationDbContext();
        }
    }
}
