import { trpc } from "@/core/client";

import type { CreateApiKeyInput, UpdateApiKeyInput } from "./keys.types";

export const keysService = {
  async create(input: CreateApiKeyInput) {
    return trpc.apikey.create.mutate(input);
  },

  async list() {
    return trpc.apikey.list.query({});
  },

  async revoke(id: string) {
    return trpc.apikey.revoke.mutate({ id });
  },

  async update(input: UpdateApiKeyInput) {
    return trpc.apikey.update.mutate(input);
  },
};
