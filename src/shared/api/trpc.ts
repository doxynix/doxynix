import { createTRPCReact } from "@trpc/react-query";
import type { inferRouterInputs, inferRouterOutputs } from "@trpc/server";

// eslint-disable-next-line boundaries/element-types
import type { AppRouter } from "@/server/trpc/router";

export const trpc = createTRPCReact<AppRouter>();

export type RouterInput = inferRouterInputs<AppRouter>;

export type RouterOutput = inferRouterOutputs<AppRouter>;

export type UiUser = RouterOutput["user"]["me"]["user"];

export type UiRepoListItem = RouterOutput["repo"]["getAll"]["items"][number];

export type UiRepoDetailed = NonNullable<RouterOutput["repo"]["getByName"]>;

export type UiRepoFile = RouterOutput["repo"]["getRepoFiles"][number];

export type DashboardStats = RouterOutput["analytics"]["getDashboardStats"];

export type RecentActivityItem = DashboardStats["recentActivity"][number];

export type LanguageMetric = DashboardStats["languages"][number];

export type TrendItem = RouterOutput["analytics"]["getTrends"][number];

export type UiApiKey = RouterOutput["apikey"]["list"]["active"][number];

export type UiNotification = RouterOutput["notification"]["getAll"][number];

export type RepoStatus = UiRepoDetailed["status"];

export type RepoVisibility = UiRepoDetailed["visibility"];

export type DocType = RouterInput["repo"]["getDocument"]["type"];

export type RepoGetAll = RouterOutput["repo"]["getAll"];

export type RepoMeta = RepoGetAll["meta"];
