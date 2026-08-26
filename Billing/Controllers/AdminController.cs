using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using System.Web;
using System.Web.Mvc;
using Microsoft.AspNet.Identity;
using Microsoft.AspNet.Identity.Owin;
using Microsoft.Owin;
using Billing.Models;
using Billing.Services;
using Billing.ViewModels;

namespace Billing.Controllers
{
    [Authorize(Roles = RoleNames.Admin)]
    public class AdminController : Controller
    {
        private ApplicationUserManager _userManager;

        public ApplicationUserManager UserManager =>
            _userManager ?? (_userManager = HttpContext.GetOwinContext().GetUserManager<ApplicationUserManager>());

        public async Task<ActionResult> Index()
        {
            var rows = new List<AdminUserRow>();
            foreach (var u in UserManager.Users.ToList())
            {
                var roles = await UserManager.GetRolesAsync(u.Id);
                rows.Add(new AdminUserRow
                {
                    Id = u.Id,
                    Email = u.Email,
                    Role = roles.FirstOrDefault() ?? "Pending",
                    CreatedOn = u.CreatedOn,
                    ApprovedBy = u.ApprovedBy,
                    ApprovedOn = u.ApprovedOn,
                });
            }

            return View(new AdminIndexViewModel
            {
                Users = rows.OrderBy(u => u.Email).ToList(),
                Message = TempData["Message"] as string,
                Error = TempData["Error"] as string,
            });
        }

        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<ActionResult> SetRole(string userId, string role)
        {
            var current = await UserManager.GetRolesAsync(userId);
            if (current.Count > 0)
            {
                await UserManager.RemoveFromRolesAsync(userId, current.ToArray());
            }

            bool grantingAccess = role == RoleNames.Admin || role == RoleNames.PM;
            if (grantingAccess)
            {
                await UserManager.AddToRoleAsync(userId, role);
            }

            var user = await UserManager.FindByIdAsync(userId);
            if (user != null)
            {
                // Reflects who approved the CURRENT access, not a history of every
                // change — cleared when access is revoked back to Pending.
                user.ApprovedBy = grantingAccess ? User.Identity.Name : null;
                user.ApprovedOn = grantingAccess ? (DateTime?)DateTime.UtcNow : null;
                await UserManager.UpdateAsync(user);
            }

            TempData["Message"] = "Role updated.";
            return RedirectToAction("Index");
        }

        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<ActionResult> ResetPassword(string userId, string newPassword)
        {
            var token = await UserManager.GeneratePasswordResetTokenAsync(userId);
            var result = await UserManager.ResetPasswordAsync(userId, token, newPassword);
            TempData[result.Succeeded ? "Message" : "Error"] = result.Succeeded
                ? "Password reset."
                : string.Join("; ", result.Errors);
            return RedirectToAction("Index");
        }

        protected override void Dispose(bool disposing)
        {
            if (disposing)
            {
                _userManager?.Dispose();
            }
            base.Dispose(disposing);
        }
    }
}
