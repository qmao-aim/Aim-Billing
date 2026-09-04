using System.Collections.Generic;
using System.Data;
using System.Linq;
using Dapper;
using Billing.Models;
using Billing.Services;

namespace Billing.DataAccess
{
    // Reads the offline AI/Azure-cost rollup tables (llm_rollup, SummarizationJobBilling,
    // ipa_caption_rollup) — ports PCStatusCheckModel.GetLLMChatCostTable/
    // GetSummarizationCostTable/GetImageCaptionCostTable, parameterized. These track
    // actual Azure/OpenAI compute cost (what Ankura pays), a different concern from
    // client billing (tier_info/billing_tier/chat_index_billing) — and unlike every
    // other table this app reads, none of the three have a `_Dev` suffix variant; they
    // only ever track Prod activity, so there is no `suffix` parameter here.
    public class AiCostRepository
    {
        public List<LlmChatCost> GetLlmChatCosts(int? year, string region)
        {
            var rows = new List<LlmChatCost>();
            foreach (var oneRegion in Regions.Resolve(region))
            {
                using (var conn = BillingDbConnectionFactory.Create(oneRegion))
                {
                    var names = GetProjectNames(conn);
                    var data = conn.Query(
                        @"SELECT [workspace_id] AS WorkspaceId, [year] AS Year, [month] AS Month,
                                 [blob_storage_cost] AS BlobStorageCost, [index_cost] AS IndexCost,
                                 [chat_cost] AS ConversationCost, [total_cost] AS TotalCost,
                                 [document_count] AS DocumentCount, [input_token_count] AS InputTokenCount,
                                 [output_token_count] AS OutputTokenCount
                          FROM [dbo].[llm_rollup]
                          WHERE (@year IS NULL OR [year] = @year)",
                        new { year });

                    foreach (var row in data)
                    {
                        int workspaceId = row.WorkspaceId;
                        rows.Add(new LlmChatCost
                        {
                            Region = oneRegion,
                            WorkspaceId = workspaceId,
                            WorkspaceName = names.TryGetValue(workspaceId, out var n) ? n : workspaceId.ToString(),
                            Year = row.Year,
                            Month = row.Month,
                            BlobStorageCost = row.BlobStorageCost ?? 0m,
                            IndexCost = row.IndexCost ?? 0m,
                            ConversationCost = row.ConversationCost ?? 0m,
                            TotalCost = row.TotalCost ?? 0m,
                            DocumentCount = row.DocumentCount ?? 0,
                            InputTokenCount = row.InputTokenCount ?? 0L,
                            OutputTokenCount = row.OutputTokenCount ?? 0L,
                        });
                    }
                }
            }
            return rows;
        }

        public List<SummarizationCost> GetSummarizationCosts(int? year, string region)
        {
            var rows = new List<SummarizationCost>();
            foreach (var oneRegion in Regions.Resolve(region))
            {
                using (var conn = BillingDbConnectionFactory.Create(oneRegion))
                {
                    var names = GetProjectNames(conn);
                    var data = conn.Query(
                        @"SELECT [workspaceId] AS WorkspaceId, [app] AS AppName, [year] AS Year, [month] AS Month,
                                 [count] AS Count, [totalCost] AS TotalCost,
                                 [totalInputTokenCount] AS TotalInputTokenCount,
                                 [totalOutputTokenCount] AS TotalOutputTokenCount
                          FROM [dbo].[SummarizationJobBilling]
                          WHERE (@year IS NULL OR [year] = @year)",
                        new { year });

                    foreach (var row in data)
                    {
                        int workspaceId = row.WorkspaceId;
                        rows.Add(new SummarizationCost
                        {
                            Region = oneRegion,
                            WorkspaceId = workspaceId,
                            WorkspaceName = names.TryGetValue(workspaceId, out var n) ? n : workspaceId.ToString(),
                            AppName = row.AppName,
                            Year = row.Year,
                            Month = row.Month,
                            Count = row.Count ?? 0,
                            TotalCost = row.TotalCost ?? 0m,
                            TotalInputTokenCount = row.TotalInputTokenCount ?? 0L,
                            TotalOutputTokenCount = row.TotalOutputTokenCount ?? 0L,
                        });
                    }
                }
            }
            return rows;
        }

        public List<ImageCaptionCost> GetImageCaptionCosts(int? year, string region)
        {
            var rows = new List<ImageCaptionCost>();
            foreach (var oneRegion in Regions.Resolve(region))
            {
                using (var conn = BillingDbConnectionFactory.Create(oneRegion))
                {
                    var names = GetProjectNames(conn);
                    var data = conn.Query(
                        @"SELECT [WorkspaceId] AS WorkspaceId, [Year] AS Year, [Month] AS Month,
                                 [ImageCount] AS ImageCount, [TotalCost] AS TotalCost
                          FROM [dbo].[ipa_caption_rollup]
                          WHERE (@year IS NULL OR [Year] = @year)",
                        new { year });

                    foreach (var row in data)
                    {
                        // legacy reads this column via GetInt64 then narrows — it's a bigint
                        // column, so Convert (not a direct cast) is needed off the dynamic row.
                        int workspaceId = System.Convert.ToInt32(row.WorkspaceId);
                        rows.Add(new ImageCaptionCost
                        {
                            Region = oneRegion,
                            WorkspaceId = workspaceId,
                            WorkspaceName = names.TryGetValue(workspaceId, out var n) ? n : workspaceId.ToString(),
                            Year = row.Year,
                            Month = row.Month,
                            ImageCount = row.ImageCount ?? 0,
                            // ipa_caption_rollup.TotalCost is `float` (unlike the decimal cost
                            // columns on the other two tables), so Dapper hands back a double —
                            // dynamic `??` can't implicitly narrow that to decimal, hence the
                            // explicit Convert instead of the `?? 0m` pattern used elsewhere here.
                            TotalCost = row.TotalCost == null ? 0m : System.Convert.ToDecimal(row.TotalCost),
                        });
                    }
                }
            }
            return rows;
        }

        // Prod-only lookup — matches PCStatusCheckModel.GetProjectNameFromID, which never
        // reads the Dev-suffixed `project_Dev` table either.
        //
        // Grouped rather than a straight ToDictionary: the US `project` table has a couple
        // of literal duplicate rows (same workspaceId, identical name/matter/etc. in every
        // column — a pre-existing data quirk, not something to fix here) that otherwise
        // throw "An item with the same key has already been added." This is a display-name
        // lookup only, so taking either duplicate's name is fine.
        private static Dictionary<int, string> GetProjectNames(IDbConnection conn)
        {
            return conn.Query("SELECT [workspaceId] AS WorkspaceId, [name] AS Name FROM [dbo].[project]")
                .GroupBy(r => (int)r.WorkspaceId)
                .ToDictionary(g => g.Key, g => (string)g.First().Name);
        }
    }
}
