export * from "./generated/api";
export * from "./generated/api.schemas";
export { setBaseUrl, setAuthTokenGetter } from "./custom-fetch";
export type { AuthTokenGetter } from "./custom-fetch";

import { useQuery, UseQueryOptions } from "@tanstack/react-query";
import { customFetch } from "./custom-fetch";

export interface GetDashboardDetailedStatsResponse {
  severity_distribution: Array<{ label: string; count: number; color: string; percentage: number }>;
  top_cities: Array<{ name: string; region: string; severity: string; cost: number }>;
  regional_stats: Record<string, { city_count: number; total_cost: number; avg_severity: number; critical_count: number; high_count: number; severity_distribution: any[]; top_cities: any[] }>;
  cost_trend: Array<{ month: string; cost: number; projected: number }>;
}

export const getGetDashboardDetailedStatsQueryKey = () => ["stats", "dashboard"];

export const useGetDashboardDetailedStats = (
  options?: { query?: UseQueryOptions<any, any, any> }
) => {
  return useQuery({
    queryKey: getGetDashboardDetailedStatsQueryKey(),
    queryFn: () => customFetch("/api/stats/detailed-metrics", { method: "GET" }),
    ...options?.query
  }) as any;
};
