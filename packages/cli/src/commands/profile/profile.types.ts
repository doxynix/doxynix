import { type RouterInput, type RouterOutput } from "@/core/client";

export type UserSessionItem = RouterOutput["user"]["getActiveSessions"][number];
export type LinkedAccountItem = RouterOutput["user"]["getLinkedAccounts"]["accounts"][number];
export type ProfileMeResponse = RouterOutput["user"]["me"];
export type DisconnectAccountInput = RouterInput["user"]["disconnectAccount"];
export type UpdateUserInput = RouterInput["user"]["updateUser"];
