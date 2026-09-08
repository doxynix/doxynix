import { type RouterInput, type RouterOutput } from "@/core/client";

export type DashboardStats = RouterOutput["analytics"]["getDashboardStats"];
export type TrendItem = RouterOutput["analytics"]["getTrends"][number];
export type DashboardStatsInput = RouterInput["analytics"]["getDashboardStats"];
export type TrendsInput = RouterInput["analytics"]["getTrends"];
