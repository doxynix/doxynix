import { trpc } from "@/core/client";

export const systemService = {
  async checkHealth() {
    return trpc.health.check.query({});
  },
};
