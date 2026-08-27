using System.Web.Http;
using Billing.DataAccess;
using Billing.Services;

namespace Billing.Controllers.Api
{
    [RoutePrefix("api")]
    public class ProjectsController : BillingApiControllerBase
    {
        private readonly BillingReadRepository _repo = new BillingReadRepository();

        [HttpGet]
        [Route("projects")]
        public IHttpActionResult GetProjects(string env, string region, bool includeTest = false, string year = null)
        {
            string suffix = SuffixFor(env);
            string normalizedRegion = NormalizeRegion(region);
            // Only Admins may ever see test workspaces, regardless of what the client asks for.
            bool includeTestEffective = includeTest && IsAdmin;
            var rows = _repo.GetProjectsAnalyzedTimeMonthTable(YearFilterParser.Parse(year), includeTestEffective, normalizedRegion, suffix);
            return Ok(rows);
        }

        [HttpGet]
        [Route("projects/{workspaceId:int}/detail")]
        public IHttpActionResult GetProjectDetail(int workspaceId, string env, string region, string year = null)
        {
            string suffix = SuffixFor(env);
            string normalizedRegion = RequireSpecificRegion(region);
            var rows = _repo.GetAnalyzedTimeMonthTable(workspaceId, YearFilterParser.Parse(year), normalizedRegion, suffix);
            return Ok(rows);
        }
    }
}
