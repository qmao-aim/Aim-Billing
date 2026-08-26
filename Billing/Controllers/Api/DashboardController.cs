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
        public IHttpActionResult GetPortfolioTotals(string env, string year = null)
        {
            string suffix = SuffixFor(env);
            return Ok(_repo.GetPortfolioTotals(YearFilterParser.Parse(year), suffix));
        }

        [HttpGet]
        [Route("app-usage")]
        public IHttpActionResult GetAppUsage(string env, string year = null)
        {
            string suffix = SuffixFor(env);
            return Ok(_repo.GetAppUsage(YearFilterParser.Parse(year), suffix));
        }

        [HttpGet]
        [Route("rate-distribution")]
        public IHttpActionResult GetRateDistribution(string env)
        {
            string suffix = SuffixFor(env);
            return Ok(_repo.GetRateDistribution(suffix));
        }
    }
}
