import type { RouterOutput } from "@/shared/api/trpc";

type RepoMapType = RouterOutput["analysis"]["getStructureMap"];

type NodeType = RouterOutput["analysis"]["getStructureNode"];

type MapNodeData = NonNullable<RepoMapType>["graph"]["nodes"][number];

export type RepoMapDisplayData = NonNullable<NodeType> | NonNullable<RepoMapType>;

export type RepoMapNodeData = MapNodeData & {
  repoMap?: {
    dimByFilter: boolean;
    dimByHover: boolean;
    dimBySearch: boolean;
  };
};
