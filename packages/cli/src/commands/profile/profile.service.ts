import { trpc } from "@/core/client";

export const profileService = {
  async deleteAccount() {
    return trpc.user.deleteAccount.mutate();
  },

  async disconnectAccount(provider: "github" | "google" | "yandex") {
    return trpc.user.disconnectAccount.mutate({ provider });
  },

  async getActiveSessions() {
    return trpc.user.getActiveSessions.query();
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

  async updateProfile(name: string) {
    return trpc.user.updateUser.mutate({ name });
  },
};
