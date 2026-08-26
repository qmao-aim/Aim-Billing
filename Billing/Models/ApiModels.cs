using System.Collections.Generic;
using Newtonsoft.Json;

namespace Billing.Models
{
    // Unlike AnalyzedTimeInfo (which deliberately mirrors the legacy server's exact
    // PascalCase field names — see that class), these are new types with no legacy
    // precedent, and the frontend's TypeScript for them uses ordinary camelCase.
    // Web API/Json.NET's default leaves C# property names as-is (PascalCase), so
    // each property here is explicitly mapped to its camelCase wire name.
    public class ConnectionStatus
    {
        [JsonProperty("online")]
        public bool Online { get; set; }

        [JsonProperty("lastSyncedOn")]
        public string LastSyncedOn { get; set; }

        [JsonProperty("minutesSinceSync")]
        public double MinutesSinceSync { get; set; }
    }

    public class SeriesPoint
    {
        [JsonProperty("label")]
        public string Label { get; set; }

        [JsonProperty("value")]
        public decimal Value { get; set; }
    }

    public class PortfolioTotals
    {
        [JsonProperty("totalBilled")]
        public decimal TotalBilled { get; set; }

        [JsonProperty("totalDocuments")]
        public long TotalDocuments { get; set; }

        [JsonProperty("activeProjects")]
        public int ActiveProjects { get; set; }

        [JsonProperty("series")]
        public List<SeriesPoint> Series { get; set; } = new List<SeriesPoint>();

        [JsonProperty("priorSeries")]
        public List<SeriesPoint> PriorSeries { get; set; }

        [JsonProperty("seriesLabel")]
        public string SeriesLabel { get; set; }

        [JsonProperty("priorSeriesLabel")]
        public string PriorSeriesLabel { get; set; }

        [JsonProperty("seriesNote")]
        public string SeriesNote { get; set; }

        [JsonProperty("changePct")]
        public decimal ChangePct { get; set; }

        [JsonProperty("changeLabel")]
        public string ChangeLabel { get; set; }
    }

    public class AppUsage
    {
        [JsonProperty("app")]
        public string App { get; set; }

        [JsonProperty("documents")]
        public long Documents { get; set; }
    }

    public class SessionInfo
    {
        [JsonProperty("role")]
        public string Role { get; set; }

        [JsonProperty("email")]
        public string Email { get; set; }

        [JsonProperty("environment")]
        public string Environment { get; set; }

        [JsonProperty("canViewDashboard")]
        public bool CanViewDashboard { get; set; }

        [JsonProperty("canSwitchEnvironment")]
        public bool CanSwitchEnvironment { get; set; }

        [JsonProperty("canViewTestWorkspaces")]
        public bool CanViewTestWorkspaces { get; set; }
    }
}
