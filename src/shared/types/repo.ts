import type { inferRouterOutputs } from "@trpc/server";

import type { AppRouter } from "@/server/trpc/router";

type RepoGetAllOutput = inferRouterOutputs<AppRouter>["repo"]["getAll"];

export type RepoTableItem = RepoGetAllOutput["items"][number];
export type RepoMeta = RepoGetAllOutput["meta"];

type RouterOutput = inferRouterOutputs<AppRouter>;
export type RepoDetailed = NonNullable<RouterOutput["repo"]["getByName"]>;

export type FileNode = {
  children?: FileNode[];
  id: string;
  name: string;
  path: string;
  recommended?: boolean;
  sha: string;
  type: string;
};
