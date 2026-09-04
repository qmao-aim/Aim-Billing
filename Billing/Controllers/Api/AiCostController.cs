using System.Web.Http;
using Billing.DataAccess;
using Billing.Services;

namespace Billing.Controllers.Api
{
    // AI/Azure compute cost (what Ankura pays Azure/OpenAI), not client billing — see
    // AiCostRepository. No `env` parameter anywhere here: unlike every other endpoint in
    // this app, the underlying tables have no Dev variant, so there is nothing to switch.
    [RoutePrefix("api/ai-costs")]
    public class AiCostController : BillingApiControllerBase
    {
        private readonly AiCostRepository _repo = new AiCostRepository();

        [HttpGet]
        [Route("llm-chat")]
        public IHttpActionResult GetLlmChatCosts(string region, string year = null)
        {
            RequireAdmin();
            string normalizedRegion = NormalizeRegion(region);
            return Ok(_repo.GetLlmChatCosts(YearFilterParser.Parse(year), normalizedRegion));
        }

        [HttpGet]
        [Route("summarization")]
        public IHttpActionResult GetSummarizationCosts(string region, string year = null)
        {
            RequireAdmin();
            string normalizedRegion = NormalizeRegion(region);
            return Ok(_repo.GetSummarizationCosts(YearFilterParser.Parse(year), normalizedRegion));
        }

        [HttpGet]
        [Route("image-caption")]
        public IHttpActionResult GetImageCaptionCosts(string region, string year = null)
        {
            RequireAdmin();
            string normalizedRegion = NormalizeRegion(region);
            return Ok(_repo.GetImageCaptionCosts(YearFilterParser.Parse(year), normalizedRegion));
        }
    }
}
