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

        public async Task<ClaimsIdentity> GenerateUserIdentityAsync(UserManager<ApplicationUser> manager)
        {
            var userIdentity = await manager.CreateIdentityAsync(this, DefaultAuthenticationTypes.ApplicationCookie);
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
