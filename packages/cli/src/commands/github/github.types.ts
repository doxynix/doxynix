import { type RouterOutput } from "../../core/client";

type MyReposResult = RouterOutput["githubApp"]["getMyGithubRepos"];
export type GitHubRepoItem = MyReposResult extends { items: (infer T)[] } ? T : never;
export type GitHubBranchItem = RouterOutput["githubBrowse"]["getBranches"][number];
export type GitHubFileItem = RouterOutput["githubBrowse"]["getRepoFiles"][number];
