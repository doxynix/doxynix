import { collectCursorPages, MAX_PAGE_SIZE } from "@doxynix/shared";

import { trpc } from "@/core/client";

import type { CreateApiKeyInput, UpdateApiKeyInput } from "./keys.types";

export const keysService = {
  async create(input: CreateApiKeyInput) {
    return trpc.apikey.create.mutate(input);
  },

  async list() {
    const [active, archived] = await Promise.all([
      collectCursorPages((cursor) => trpc.apikey.list.query({ cursor, limit: MAX_PAGE_SIZE })),
      collectCursorPages((cursor) =>
        trpc.apikey.listArchived.query({ cursor, limit: MAX_PAGE_SIZE }),
      ),
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
