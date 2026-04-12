import { createTRPCReact } from "@trpc/react-query";
import type { inferRouterInputs, inferRouterOutputs } from "@trpc/server";

import type { AppRouter } from "@/server/api/routers";

export const trpc = createTRPCReact<AppRouter>();

export type RouterInput = inferRouterInputs<AppRouter>;

export type RouterOutput = inferRouterOutputs<AppRouter>;

export type UiUser = RouterOutput["user"]["me"]["user"];

export type UiRepoListItem = RouterOutput["repo"]["getAll"]["items"][number];

export type UiRepoDetailed = NonNullable<RouterOutput["repo"]["getByName"]>;

export type DashboardStats = RouterOutput["analytics"]["getDashboardStats"];

export type RecentActivityItem = DashboardStats["recentActivity"][number];

export type LanguageMetric = DashboardStats["languages"][number];

export type TrendItem = RouterOutput["analytics"]["getTrends"][number];

export type UiApiKey = RouterOutput["apikey"]["list"]["active"][number];

export type UiNotification = RouterOutput["notification"]["getAll"]["items"][number];

export type NotificationType = UiNotification["type"];

export type RepoStatus = UiRepoDetailed["status"];

export type RepoVisibility = UiRepoDetailed["visibility"];

export type DocType = RouterInput["repoDetails"]["getDocumentContent"]["type"];

export type RepoGetAll = RouterOutput["repo"]["getAll"];

export type RepoMeta = RepoGetAll["meta"];

export type NotificationGetAll = RouterOutput["notification"]["getAll"];

export type NotificationMeta = NotificationGetAll["meta"];

export type MarkAllInput = RouterInput["notification"]["markAllAsRead"];

export type RepoDetailsOverview = RouterOutput["repoDetails"]["getOverview"];

export type UiRepoHistory = RouterOutput["repoDetails"]["getHistory"];

export type FileContent = RouterOutput["githubBrowse"]["getFileContent"];

export type FileMeta = RouterOutput["githubBrowse"]["getFileContent"]["meta"];

export type RepoMetricsItem = RouterOutput["repoDetails"]["getDetailedMetrics"];

export type AvailableDocs = RouterOutput["repoDetails"]["getAvailableDocs"];

export type RepoMapType = RouterOutput["repoDetails"]["getStructureMap"];

export type InteractiveBrief = RouterOutput["repoDetails"]["getInteractiveBrief"];

export type NodeType = RouterOutput["repoDetails"]["getStructureNode"];

export type MapNodeData = NonNullable<RepoMapType>["graph"]["nodes"][number];

export type MapEdgeData = NonNullable<RepoMapType>["graph"]["edges"][number];

export type RepoMapDisplayData = NonNullable<NodeType> | NonNullable<RepoMapType>;

export type NodeBrief = NonNullable<RouterOutput["repoDetails"]["getInteractiveBriefNode"]>;
