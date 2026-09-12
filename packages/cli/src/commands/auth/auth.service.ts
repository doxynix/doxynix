import { trpc } from "@/core/client";
import { getToken, removeToken, saveToken, setSessionToken } from "@/core/config";

export const authService = {
  getToken,
  removeToken,
  saveToken,
  setSessionToken,

  async verifyCurrentUser() {
    return trpc.user.me.query();
  },
};
