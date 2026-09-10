import { trpc } from "@/core/client";

import type { RepoFilterInput, RepoFilterSlimInput } from "./repos.types";

export const reposService = {
  async add(url: string) {
    return trpc.repo.create.mutate({ url });
  },

  async delete(id: string) {
    return trpc.repo.delete.mutate({ id });
  },

  async deleteAll() {
    return trpc.repo.deleteAll.mutate({});
  },

  async deleteByOwner(owner: string) {
    return trpc.repo.deleteByOwner.mutate({ owner });
  },

  async getByName(owner: string, name: string) {
    return trpc.repo.getByName.query({ name, owner });
  },

  async getByOwner(owner: string) {
    return trpc.repo.getByOwner.query({ owner });
  },

  async getSlim(input?: RepoFilterSlimInput) {
    return trpc.repo.getSlim.query(input ?? {});
  },

  async list(input?: RepoFilterInput) {
    return trpc.repo.getAll.query(input ?? {});
  },
};
