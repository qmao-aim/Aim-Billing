using System.Collections.Generic;

namespace Billing.Models
{
    // Field names/casing must match billing-app/src/api/types.ts's AnalyzedTimeInfo verbatim
    // (PascalCase) so the SPA can deserialize with no mapping layer.
    public class AnalyzedTimeInfo
    {
        // Which region's database this row actually came from ("US"/"UK"), or
        // "Global" for the synthetic combined-total row. Lets the frontend build
        // a correct /projects/{region}/{id} link for a row even when the list
        // itself was requested with region=global (a merge of both).
        public string Region { get; set; }

        public int WorkspaceId { get; set; }
        public string WorkspaceName { get; set; }
        public string MatterNumber { get; set; }
        public string ProdType { get; set; }
        public decimal UnitPrice { get; set; }
        public string JobName { get; set; }
        public int TotalCount { get; set; }
        public int TotalBillCount { get; set; }
        public decimal TotalPrice { get; set; }
        public int YearCount { get; set; }
        public decimal JobUnitRate { get; set; }
        public int JobThreshold { get; set; }
        public List<int> Counts { get; set; } = new List<int>(new int[12]);
        public List<decimal> Money { get; set; } = new List<decimal>(new decimal[12]);

        // Sentinels for "not tracked at this row's granularity" — mirrors the legacy
        // convention of Money=-1 on per-app rows (a tier can bundle several apps, so
        // there's no ground truth for a single app's dollar share of a tier).
        public static AnalyzedTimeInfo WithUntrackedMoney()
        {
            return new AnalyzedTimeInfo
            {
                TotalBillCount = -1,
                TotalPrice = -1,
                Money = new List<decimal>(new decimal[12]) { }
            };
        }
    }
}
