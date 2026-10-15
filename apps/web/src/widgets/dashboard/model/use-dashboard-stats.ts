import { useQuery } from "@tanstack/react-query";
import { useQueryStates } from "nuqs";

import { useTRPC } from "@/shared/api/trpc";

import {
  dashboardParsers,
  dashboardRangeInput,
} from "@/features/repo-analytics/model/dashboard-parsers";

export function useDashboardStats() {
  const trpc = useTRPC();
  const [urlParams] = useQueryStates(dashboardParsers);

  return useQuery(trpc.analytics.getDashboardStats.queryOptions(dashboardRangeInput(urlParams)));
}
