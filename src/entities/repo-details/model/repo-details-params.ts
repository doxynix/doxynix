import { createSerializer, parseAsString } from "nuqs/server";

export const repoWorkspaceParams = {
  filter: parseAsString,
  node: parseAsString,
  path: parseAsString,
  search: parseAsString,
  section: parseAsString,
  type: parseAsString,
  view: parseAsString,
};

export const serializeRepoParams = createSerializer(repoWorkspaceParams);
