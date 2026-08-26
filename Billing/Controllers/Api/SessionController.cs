using System.Web.Http;
using Billing.Models;

namespace Billing.Controllers.Api
{
    [RoutePrefix("api/session")]
    public class SessionController : BillingApiControllerBase
    {
        [HttpGet]
        [Route("")]
        public IHttpActionResult Get()
        {
            bool isAdmin = IsAdmin;
            return Ok(new SessionInfo
            {
                Role = isAdmin ? "admin" : "pm",
                Email = CurrentUserEmail,
                Environment = "prod",
                CanViewDashboard = isAdmin,
                CanSwitchEnvironment = isAdmin,
                CanViewTestWorkspaces = isAdmin,
            });
        }
    }
}
