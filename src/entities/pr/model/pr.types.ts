import type { RouterOutput } from "@/shared/api/trpc";

export type RepoPull = RouterOutput["prAnalysis"]["listByRepository"][number];

export type PRNumber = RouterOutput["prAnalysis"]["getByPRNumber"];

export type PRImpact = RouterOutput["prAnalysis"]["getImpactByPRNumber"];
