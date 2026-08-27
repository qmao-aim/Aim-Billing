using System;
using System.Linq;
using System.Web.Http;
using Billing.DataAccess;
using Billing.Models;
using Billing.Services;

namespace Billing.Controllers.Api
{
    [RoutePrefix("api/connection-status")]
    public class ConnectionStatusController : BillingApiControllerBase
    {
        private readonly ProjectRepository _repo = new ProjectRepository();

        [HttpGet]
        [Route("")]
        public IHttpActionResult Get(string region)
        {
            var normalizedRegion = NormalizeRegion(region);

            // Not environment-scoped in the SPA's contract — mirrors legacy BillingStatusJson,
            // which always watches the prod sync clock regardless of suffix. For Global,
            // report the OLDEST sync across regions — a stale region should still surface
            // as "connection is off", not get hidden behind a fresher one.
            var oldestSynced = Regions.Resolve(normalizedRegion)
                .Select(r => _repo.GetLatestSyncedTime(r, ""))
                .Min();
            var minutes = (DateTime.UtcNow - oldestSynced).TotalMinutes;
            return Ok(new ConnectionStatus
            {
                Online = minutes < 65,
                LastSyncedOn = oldestSynced.ToString("o"),
                MinutesSinceSync = Math.Round(minutes, 1),
            });
        }
    }
}
