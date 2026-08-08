import type { RouterOutput } from "@/shared/api/trpc";

export type UiApiKey = RouterOutput["apikey"]["list"]["active"][number];
