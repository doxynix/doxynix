import { trpc } from "@/core/client";

export const profileService = {
  async deleteAccount() {
    return trpc.user.deleteAccount.mutate();
  },
  async getProfile() {
    return trpc.user.me.query();
  },

  async updateProfile(name: string) {
    return trpc.user.updateUser.mutate({ name });
  },
};
