import type { RouterInput, RouterOutput } from "@/shared/api/trpc";

export type UiRepoListItem = RouterOutput["repo"]["getAll"]["items"][number];

export type UiRepoDetailed = NonNullable<RouterOutput["repo"]["getByName"]>;

export type RepoStatus = UiRepoDetailed["status"];

export type RepoGetAll = RouterOutput["repo"]["getAll"];

export type RepoMeta = RepoGetAll["meta"];

export type DocType = RouterInput["repoDetails"]["getDocumentContent"]["type"];

export type DocContent = RouterOutput["repoDetails"]["getDocumentContent"];

export type RepoWorkspace = RouterOutput["repoDetails"]["getWorkspace"];

export type UiRepoHistory = RouterOutput["repoDetails"]["getHistory"];

export type RepoMetricsItem = RouterOutput["repoDetails"]["getDetailedMetrics"];

export type AvailableDocs = RouterOutput["repoDetails"]["getAvailableDocs"];

export type RepoNodeContext = RouterOutput["repoDetails"]["getNodeContext"];

export type RepoSearchResult = RouterOutput["repoDetails"]["searchWorkspace"][number];

export type FileContent = RouterOutput["githubBrowse"]["getFileContent"];

export type FileMeta = RouterOutput["githubBrowse"]["getFileContent"]["meta"];
