import type { RouterInput, RouterOutput } from "@/core/client";

export type ApiKeyItem = RouterOutput["apikey"]["list"]["active"][number];
export type ApiKeyListResponse = RouterOutput["apikey"]["list"];
export type CreateApiKeyInput = RouterInput["apikey"]["create"];
export type UpdateApiKeyInput = RouterInput["apikey"]["update"];
export type RevokeApiKeyInput = RouterInput["apikey"]["revoke"];
