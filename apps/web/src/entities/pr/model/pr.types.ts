import type { RouterOutput } from "@/shared/api/trpc";

export type RepoPull = RouterOutput["analysis"]["listByRepository"][number];

export type PRNumber = RouterOutput["analysis"]["getByPRNumber"];

export type PRImpact = RouterOutput["analysis"]["getImpactByPRNumber"];
