import { inferRouterOutputs } from "@trpc/server";

import { AppRouter } from "@/server/trpc/router";

type RepoGetAllOutput = inferRouterOutputs<AppRouter>["repo"]["getAll"];

export type RepoTableItem = RepoGetAllOutput["items"][number];
export type RepoMeta = RepoGetAllOutput["meta"];

export interface RepoListProps {
  repos: RepoTableItem[];
  meta?: RepoMeta;
}
