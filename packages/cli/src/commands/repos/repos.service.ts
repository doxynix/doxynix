import { trpc } from "@/core/client";

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

  async list(limit = 20, search?: string, owner?: string) {
    return trpc.repo.getAll.query({
      cursor: 1,
      limit,
      owner,
      search,
      sortBy: "createdAt",
      sortOrder: "desc",
    });
  },
};
