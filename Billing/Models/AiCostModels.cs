using Newtonsoft.Json;

namespace Billing.Models
{
    // Ports PredictiveCodingNet.Models.PCStatusCheckModel's GetLLMChatCostTable/
    // GetSummarizationCostTable/GetImageCaptionCostTable row shapes (LLMChatCostRow/
    // SummarizationCostRow/ImageCaptionCostRow). These track actual Azure/OpenAI compute
    // cost (what Ankura pays) — a different concern from client billing
    // (BillingRule/tier_info/chat_index_billing). New types with no legacy JSON
    // precedent, so — like every non-AnalyzedTimeInfo type here — camelCase on the wire.
    public class LlmChatCost
    {
        [JsonProperty("region")]
        public string Region { get; set; }

        [JsonProperty("workspaceId")]
        public int WorkspaceId { get; set; }

        [JsonProperty("workspaceName")]
        public string WorkspaceName { get; set; }

        [JsonProperty("year")]
        public int Year { get; set; }

        [JsonProperty("month")]
        public int Month { get; set; }

        [JsonProperty("blobStorageCost")]
        public decimal BlobStorageCost { get; set; }

        [JsonProperty("indexCost")]
        public decimal IndexCost { get; set; }

        [JsonProperty("conversationCost")]
        public decimal ConversationCost { get; set; }

        [JsonProperty("totalCost")]
        public decimal TotalCost { get; set; }

        [JsonProperty("documentCount")]
        public int DocumentCount { get; set; }

        [JsonProperty("inputTokenCount")]
        public long InputTokenCount { get; set; }

        [JsonProperty("outputTokenCount")]
        public long OutputTokenCount { get; set; }
    }

    public class SummarizationCost
    {
        [JsonProperty("region")]
        public string Region { get; set; }

        [JsonProperty("workspaceId")]
        public int WorkspaceId { get; set; }

        [JsonProperty("workspaceName")]
        public string WorkspaceName { get; set; }

        [JsonProperty("appName")]
        public string AppName { get; set; }

        [JsonProperty("year")]
        public int Year { get; set; }

        [JsonProperty("month")]
        public int Month { get; set; }

        [JsonProperty("count")]
        public int Count { get; set; }

        [JsonProperty("totalCost")]
        public decimal TotalCost { get; set; }

        [JsonProperty("totalInputTokenCount")]
        public long TotalInputTokenCount { get; set; }

        [JsonProperty("totalOutputTokenCount")]
        public long TotalOutputTokenCount { get; set; }
    }

    public class ImageCaptionCost
    {
        [JsonProperty("region")]
        public string Region { get; set; }

        [JsonProperty("workspaceId")]
        public int WorkspaceId { get; set; }

        [JsonProperty("workspaceName")]
        public string WorkspaceName { get; set; }

        [JsonProperty("year")]
        public int Year { get; set; }

        [JsonProperty("month")]
        public int Month { get; set; }

        [JsonProperty("imageCount")]
        public int ImageCount { get; set; }

        [JsonProperty("totalCost")]
        public decimal TotalCost { get; set; }
    }
}
