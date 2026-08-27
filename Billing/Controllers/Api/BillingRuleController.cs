using System.Web.Http;
using Billing.DataAccess;
using Billing.Models;

namespace Billing.Controllers.Api
{
    [RoutePrefix("api/projects/{workspaceId:int}/rule")]
    public class BillingRuleController : BillingApiControllerBase
    {
        private readonly BillingRuleRepository _repo = new BillingRuleRepository();

        [HttpGet]
        [Route("")]
        public IHttpActionResult Get(int workspaceId, string env, string region)
        {
            string suffix = SuffixFor(env);
            string normalizedRegion = RequireSpecificRegion(region);
            return Ok(_repo.GetRule(workspaceId, normalizedRegion, suffix));
        }

        [HttpPost]
        [Route("")]
        public IHttpActionResult Post(int workspaceId, string env, string region, [FromBody] BillingRule rule)
        {
            string suffix = SuffixFor(env);
            string normalizedRegion = RequireSpecificRegion(region);
            // savedBy is derived from the authenticated user, never trusted from the body —
            // otherwise a caller could attribute a rule change to someone else.
            var result = _repo.SaveRule(workspaceId, normalizedRegion, suffix, rule, CurrentUserEmail);
            return Ok(result);
        }
    }
}
