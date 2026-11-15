import { MAX_PAGE_SIZE } from "@doxynix/shared";

import { trpc } from "@/core/client";

import type { DisconnectAccountInput } from "./profile.types";

export const profileService = {
  async deleteAccount() {
    return trpc.user.deleteAccount.mutate();
  },

  async disconnectAccount(provider: DisconnectAccountInput) {
    return trpc.user.disconnectAccount.mutate(provider);
  },

  async getActiveSessions(limit = MAX_PAGE_SIZE) {
    const { items } = await trpc.user.getActiveSessions.query({ limit });

    return items;
  },

  async getLinkedAccounts() {
    return trpc.user.getLinkedAccounts.query();
  },

  async getProfile() {
    return trpc.user.me.query();
  },

  async removeAvatar() {
    return trpc.user.removeAvatar.mutate({});
  },

  async revokeSession(sessionId: string) {
    return trpc.user.revokeSession.mutate({ sessionId });
  },

  async updateProfile(name: string) {
    return trpc.user.updateUser.mutate({ name });
  },
};
