"use client";

import { useParams } from "next/navigation";
import { parseAsString, useQueryState } from "nuqs";

export function useRepoParams() {
  const params = useParams();
  const [aid] = useQueryState("aid", parseAsString);

  const owner = Array.isArray(params.owner) ? params.owner[0] : params.owner;
  const name = Array.isArray(params.name) ? params.name[0] : params.name;

  const isRepoContext = typeof owner === "string" && typeof name === "string";

  return {
    aid,
    name: isRepoContext ? name : "",
    owner: isRepoContext ? owner : "",
  } as const;
}
