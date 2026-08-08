import type { RouterOutput } from "@/shared/api/trpc";

export type LinkedAccounts = RouterOutput["user"]["getLinkedAccounts"]["accounts"];

export type LinkedUser = RouterOutput["user"]["getLinkedAccounts"]["user"];
