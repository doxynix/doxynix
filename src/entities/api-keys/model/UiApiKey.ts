import { ApiKey } from "@/generated/zod";

export type UiApiKey = Omit<ApiKey, "hashedKey" | "userId">;
