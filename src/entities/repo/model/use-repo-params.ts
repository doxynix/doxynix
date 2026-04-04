"use client";

import { useParams } from "next/navigation";

export function useRepoParams() {
  const params = useParams();

  const owner = Array.isArray(params.owner) ? params.owner[0] : params.owner;
  const name = Array.isArray(params.name) ? params.name[0] : params.name;

  const isRepoContext = typeof owner === "string" && typeof name === "string";

  return {
    name: isRepoContext ? name : "",
    owner: isRepoContext ? owner : "",
  } as const;
}
