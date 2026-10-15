import { skipToken, useQuery } from "@tanstack/react-query";

import { useTRPC } from "@/shared/api/trpc";

type Props = {
  aid?: string;
  nodeId?: null | string;
  repoId: string;
};

export function useNodeContext({ aid, nodeId, repoId }: Readonly<Props>) {
  const trpc = useTRPC();

  return useQuery(
    trpc.analysis.getNodeContext.queryOptions(nodeId ? { aid, nodeId, repoId } : skipToken),
  );
}
