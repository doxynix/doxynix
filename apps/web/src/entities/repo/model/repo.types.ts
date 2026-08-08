import type { RouterInput, RouterOutput } from "@/shared/api/trpc";

export type UiRepoListItem = RouterOutput["repo"]["getAll"]["items"][number];

export type UiRepoDetailed = NonNullable<RouterOutput["repo"]["getByName"]>;

export type RepoStatus = UiRepoDetailed["status"];

export type RepoGetAll = RouterOutput["repo"]["getAll"];

export type RepoMeta = RepoGetAll["meta"];

export type DocType = RouterInput["analysis"]["getDocumentContent"]["type"];

export type DocContent = RouterOutput["analysis"]["getDocumentContent"];

export type RepoWorkspace = RouterOutput["analysis"]["getWorkspace"];

export type RepoMetricsItem = RouterOutput["analysis"]["getDetailedMetrics"];

export type AvailableDocs = RouterOutput["analysis"]["getAvailableDocs"];

export type RepoNodeContext = RouterOutput["analysis"]["getNodeContext"];

export type RepoSearchResult = RouterOutput["analysis"]["searchWorkspace"][number];

export type FileContent = RouterOutput["githubBrowse"]["getFileContent"];

export type FileMeta = RouterOutput["githubBrowse"]["getFileContent"]["meta"];
