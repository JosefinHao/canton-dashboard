import { useQuery } from "@tanstack/react-query";
import { fetchDashboards, type RawDashboard } from "@/utils/dashboardService";

export const useDashboards = () => {
  return useQuery<RawDashboard[]>({
    queryKey: ["dashboards"],
    queryFn: fetchDashboards,
    staleTime: 5 * 60 * 1000,
    retry: 2,
  });
};
