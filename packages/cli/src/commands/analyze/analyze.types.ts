import { type RouterInput, type RouterOutput } from "@/core/client";

export type RepoConfig = NonNullable<RouterOutput["analysis"]["getRepoConfig"]>;
export type ConfigureRepositoryInput = RouterInput["analysis"]["configureRepository"];
export type AnalysisItem = NonNullable<RouterOutput["analysis"]["getLatest"]>;
export type AnalysisHistoryItem = RouterOutput["analysis"]["getHistory"][number];
export type DetailedMetrics = RouterOutput["analysis"]["getDetailedMetrics"];
export type StructureMap = RouterOutput["analysis"]["getStructureMap"];
export type WorkspaceSearchResult = RouterOutput["analysis"]["searchWorkspace"];
export type StartAnalysisInput = RouterInput["analysis"]["analyze"];
export type GetDetailedMetricsInput = RouterInput["analysis"]["getDetailedMetrics"];
export type GetStructureMapInput = RouterInput["analysis"]["getStructureMap"];
export type SearchWorkspaceInput = RouterInput["analysis"]["searchWorkspace"];
export type QuickFileAuditInput = RouterInput["analysis"]["quickFileAudit"];
