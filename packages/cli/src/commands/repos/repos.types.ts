import type { RouterInput, RouterOutput } from "@/core/client";

export type RepoListItem = RouterOutput["repo"]["getAll"]["items"][number];
export type RepoDetails = NonNullable<RouterOutput["repo"]["getByName"]>;
export type RepoByOwnerDetails = NonNullable<RouterOutput["repo"]["getByOwner"]>;
export type SlimRepoItem = RouterOutput["repo"]["getSlim"]["items"][number];
export type SlimRepoResponse = RouterOutput["repo"]["getSlim"];
export type RepoFilterInput = RouterInput["repo"]["getAll"];
export type RepoFilterSlimInput = RouterInput["repo"]["getSlim"];
