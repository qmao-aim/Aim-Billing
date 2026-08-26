using System;
using System.Web.Http;
using Billing.DataAccess;
using Billing.Models;

namespace Billing.Controllers.Api
{
    [RoutePrefix("api/connection-status")]
    public class ConnectionStatusController : BillingApiControllerBase
    {
        private readonly ProjectRepository _repo = new ProjectRepository();

        [HttpGet]
        [Route("")]
        public IHttpActionResult Get()
        {
            // Not environment-scoped in the SPA's contract — mirrors legacy BillingStatusJson,
            // which always watches the prod sync clock regardless of suffix.
            var lastSynced = _repo.GetLatestSyncedTime("");
            var minutes = (DateTime.UtcNow - lastSynced).TotalMinutes;
            return Ok(new ConnectionStatus
            {
                Online = minutes < 65,
                LastSyncedOn = lastSynced.ToString("o"),
                MinutesSinceSync = Math.Round(minutes, 1),
            });
        }
    }
}
