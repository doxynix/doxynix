import type { RouterOutput } from "@/shared/api/trpc";

export type DashboardStats = RouterOutput["analytics"]["getDashboardStats"];
