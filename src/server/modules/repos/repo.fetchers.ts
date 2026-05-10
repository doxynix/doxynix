import type { cache } from "react";
import type { notFound } from "next/navigation";

import type { api } from "@/server/core/trpc/server";

export const repoFetchers = {
  getOwnerOrNotFound: cache(async (owner: string) => {
    const serverApi = await api();
    const data = await serverApi.repo.getByOwner({ owner });

    if (data == null) {
      notFound();
    }

    return data;
  }),

  getRepoOrNotFound: cache(async (owner: string, name: string) => {
    const serverApi = await api();
    const repo = await serverApi.repo.getByName({
      name,
      owner,
    });

    if (repo == null) {
      notFound();
    }

    return repo;
  }),
};
