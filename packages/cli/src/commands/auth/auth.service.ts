import { trpc } from "@/core/client";
import { getToken, removeToken, saveToken } from "@/core/config";

export const authService = {
  getToken,
  removeToken,
  saveToken,

  async verifyCurrentUser() {
    return trpc.user.me.query();
  },
};
