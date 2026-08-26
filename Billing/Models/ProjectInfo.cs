using System;
using System.Collections.Generic;

namespace Billing.Models
{
    // Internal repository DTO — not returned to the SPA directly. Mirrors the fields
    // PredictiveCodingNet.Models.PCStatusCheckModel.ProjectInfo carries.
    public class ProjectInfo
    {
        public int WorkspaceId { get; set; }
        public string Name { get; set; }
        public string MatterNumber { get; set; }
        public string ProdInfo { get; set; }
        public decimal UnitPrice { get; set; }
        public int UnitThreshold { get; set; }
        public int IsDefined { get; set; } = -1; // -1 undefined, 0 billable, 1 test
        public bool IsTest => IsDefined == 1;
        public bool HasExclude { get; set; }
        public bool SingleUnitRate { get; set; } = true;
        public decimal? ChatUnitPrice { get; set; }
        public int? ChatPeriod { get; set; }
        public string CreatedBy { get; set; }
        public DateTime? CreatedOn { get; set; }
        public DateTime? SyncedOn { get; set; }

        public Dictionary<string, string> JobGroupList { get; set; } = new Dictionary<string, string>();
        public Dictionary<string, bool> ExcludeList { get; set; } = new Dictionary<string, bool>();
        public Dictionary<string, decimal> UnitRates { get; set; } = new Dictionary<string, decimal>();
        public Dictionary<string, int> Thresholds { get; set; } = new Dictionary<string, int>();

        public int TierTotalCount { get; set; }
        public decimal TierTotalPrice { get; set; }
    }
}
