import type { RouterOutput } from "@/core/client";

export type AuthUser = RouterOutput["user"]["me"]["user"];
export type AuthMeResponse = RouterOutput["user"]["me"];
