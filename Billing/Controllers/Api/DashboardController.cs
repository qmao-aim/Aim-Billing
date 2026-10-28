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

        // Admin-only, like the AI-cost endpoints — this is per-workspace dollar detail
        // meant for Finance, not something a PM's own project view needs to expose.
        [HttpGet]
        [Route("financial-report")]
        public IHttpActionResult GetFinancialReport(string env, string region, int year, int month)
        {
            RequireAdmin();
            string suffix = SuffixFor(env);
            string normalizedRegion = NormalizeRegion(region);
            return Ok(_repo.GetFinancialReport(year, month, normalizedRegion, suffix));
        }
    }
}
