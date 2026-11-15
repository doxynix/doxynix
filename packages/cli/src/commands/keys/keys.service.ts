import { isApiKeyDead, MAX_PAGE_SIZE } from "@doxynix/shared";

import { trpc } from "@/core/client";

import type { CreateApiKeyInput, UpdateApiKeyInput } from "./keys.types";

export const keysService = {
  async create(input: CreateApiKeyInput) {
    return trpc.apikey.create.mutate(input);
  },

  async list() {
    const { items } = await trpc.apikey.list.query({ limit: MAX_PAGE_SIZE });
    const now = Date.now();

    return {
      active: items.filter((key) => !isApiKeyDead(key, now)),
      archived: items.filter((key) => isApiKeyDead(key, now)),
    };
  },

  async revoke(id: string) {
    return trpc.apikey.revoke.mutate({ id });
  },

  async update(input: UpdateApiKeyInput) {
    return trpc.apikey.update.mutate(input);
  },
};
