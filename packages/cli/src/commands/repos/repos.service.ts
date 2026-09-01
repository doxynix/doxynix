import { trpc } from "@/core/client";

export const reposService = {
  async add(url: string) {
    return trpc.repo.create.mutate({ url });
  },

  async delete(id: string) {
    return trpc.repo.delete.mutate({ id });
  },

  async getByName(owner: string, name: string) {
    return trpc.repo.getByName.query({ name, owner });
  },
  async list(limit = 20, search?: string) {
    return trpc.repo.getAll.query({
      cursor: 1,
      limit,
      search,
      sortBy: "createdAt",
      sortOrder: "desc",
    });
  },
};
