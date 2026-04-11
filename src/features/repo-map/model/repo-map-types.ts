import type { MapNodeData } from "@/shared/api/trpc";

export type RepoMapNodeData = MapNodeData & {
  repoMap?: {
    dimByFilter: boolean;
    dimByHover: boolean;
    dimBySearch: boolean;
  };
};
