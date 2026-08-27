using System.Web.Http;
using Billing.DataAccess;
using Billing.Services;

namespace Billing.Controllers.Api
{
    [RoutePrefix("api")]
    public class DashboardController : BillingApiControllerBase
    {
        private readonly DashboardRepository _repo = new DashboardRepository();

        [HttpGet]
        [Route("portfolio-totals")]
        public IHttpActionResult GetPortfolioTotals(string env, string region, string year = null)
        {
            string suffix = SuffixFor(env);
            string normalizedRegion = NormalizeRegion(region);
            return Ok(_repo.GetPortfolioTotals(YearFilterParser.Parse(year), normalizedRegion, suffix));
        }

        [HttpGet]
        [Route("app-usage")]
        public IHttpActionResult GetAppUsage(string env, string region, string year = null)
        {
            string suffix = SuffixFor(env);
            string normalizedRegion = NormalizeRegion(region);
            return Ok(_repo.GetAppUsage(YearFilterParser.Parse(year), normalizedRegion, suffix));
        }

        [HttpGet]
        [Route("rate-distribution")]
        public IHttpActionResult GetRateDistribution(string env, string region)
        {
            string suffix = SuffixFor(env);
            string normalizedRegion = NormalizeRegion(region);
            return Ok(_repo.GetRateDistribution(normalizedRegion, suffix));
        }
    }
}
