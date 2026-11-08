import { useQuery } from "@tanstack/react-query";

import { useTRPC } from "@/shared/api/trpc";

export function useNotificationStats() {
  const trpc = useTRPC();

  return useQuery(trpc.notification.getStats.queryOptions());
}
