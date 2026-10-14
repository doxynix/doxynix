import type { RouterOutput } from "@/shared/api/trpc";

export type RepoPull = RouterOutput["analysis"]["listByRepository"]["items"][number];

export type PRNumber = RouterOutput["analysis"]["getByPRNumber"];
