import { MAX_PAGE_SIZE } from "@doxynix/shared";

import { trpc } from "@/core/client";

import type { CreateApiKeyInput, UpdateApiKeyInput } from "./keys.types";

export const keysService = {
  async create(input: CreateApiKeyInput) {
    return trpc.apikey.create.mutate(input);
  },

  async list() {
    const [{ items: active }, { items: archived }] = await Promise.all([
      trpc.apikey.list.query({ limit: MAX_PAGE_SIZE }),
      trpc.apikey.listArchived.query(),
    ]);

    return { active, archived };
  },

  async revoke(id: string) {
    return trpc.apikey.revoke.mutate({ id });
  },

  async update(input: UpdateApiKeyInput) {
    return trpc.apikey.update.mutate(input);
  },
};
