using System;
using System.Collections.Generic;
using Newtonsoft.Json;

namespace Billing.Models
{
    // Mirrors billing-app/src/api/types.ts's BillingRule — camelCase on the wire,
    // like every non-legacy type here (see Models/ApiModels.cs for why).
    public class BillingRule
    {
        [JsonProperty("workspaceId")]
        public int WorkspaceId { get; set; }

        [JsonProperty("workspaceName")]
        public string WorkspaceName { get; set; }

        [JsonProperty("isDefined")]
        public int IsDefined { get; set; } // -1 undefined/editable, 0 billable/locked, 1 test/locked

        [JsonProperty("isTest")]
        public bool IsTest { get; set; }

        [JsonProperty("isAppExcluded")]
        public bool IsAppExcluded { get; set; }

        [JsonProperty("sameUnitPrice")]
        public bool SameUnitPrice { get; set; }

        [JsonProperty("unitPrice")]
        public decimal UnitPrice { get; set; }

        [JsonProperty("threshold")]
        public int Threshold { get; set; }

        // Vero/Chat is billed separately from the tiered apps above (docCount x
        // chat_unit_price on creation, then again every chat_period months while
        // active — see UpdateChatIndexBilling in the offline job). Zeroed when isTest.
        [JsonProperty("chatUnitPrice")]
        public decimal ChatUnitPrice { get; set; }

        [JsonProperty("chatPeriod")]
        public int ChatPeriod { get; set; }

        [JsonProperty("jobExcludeList")]
        public Dictionary<string, bool> JobExcludeList { get; set; } = new Dictionary<string, bool>();

        [JsonProperty("jobGroupList")]
        public Dictionary<string, string> JobGroupList { get; set; } = new Dictionary<string, string>();

        [JsonProperty("unitPrices")]
        public Dictionary<string, decimal> UnitPrices { get; set; } = new Dictionary<string, decimal>();

        [JsonProperty("thresholdValues")]
        public Dictionary<string, int> ThresholdValues { get; set; } = new Dictionary<string, int>();

        [JsonProperty("createdBy")]
        public string CreatedBy { get; set; }

        [JsonProperty("createdOn")]
        public DateTime? CreatedOn { get; set; }
    }

    public class SaveRuleResult
    {
        [JsonProperty("ok")]
        public bool Ok { get; set; }

        [JsonProperty("message")]
        public string Message { get; set; }

        public static SaveRuleResult Success() => new SaveRuleResult { Ok = true };
        public static SaveRuleResult Failure(string message) => new SaveRuleResult { Ok = false, Message = message };
    }
}
