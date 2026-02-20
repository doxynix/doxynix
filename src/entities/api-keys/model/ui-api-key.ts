import type { ApiKey } from "@/generated/zod";

export type UiApiKey = Omit<ApiKey, "hashedKey" | "userId">;
