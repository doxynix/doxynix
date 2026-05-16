import type { ReadonlyURLSearchParams } from "next/navigation";

import { serializeRepoParams } from "./repo-details-params";
import type { RepoSearchResult } from "./repo.types";

export function buildRepoDetailHref(
  basePath: string,
  searchParams?: null | ReadonlyURLSearchParams | URLSearchParams
) {
  if (searchParams == null) return basePath;

  return serializeRepoParams(basePath, {
    filter: searchParams.get("filter"),
    node: searchParams.get("node"),
    path: searchParams.get("path"),
    search: searchParams.get("search"),
    section: searchParams.get("section"),
    type: searchParams.get("type"),
    view: searchParams.get("view"),
  });
}

export function buildRepoCodeHref(params: {
  name: string;
  nodeId?: null | string;
  owner: string;
  path?: null | string;
  aid?: string | null;
}) {
  const base = `/dashboard/repo/${encodeURIComponent(params.owner)}/${encodeURIComponent(params.name)}/code`;

  return serializeRepoParams(base, {
    node: params.nodeId,
    path: params.path,
    aid: params.aid,
  });
}

export function buildRepoDocsHref(params: {
  docType?: null | string;
  name: string;
  nodeId?: null | string;
  owner: string;
  section?: null | string;
  aid?: string | null;
}) {
  const base = `/dashboard/repo/${encodeURIComponent(params.owner)}/${encodeURIComponent(params.name)}/docs`;

  return serializeRepoParams(base, {
    node: params.nodeId,
    section: params.section,
    type: params.docType,
    aid: params.aid,
  });
}

export function buildRepoMapHref(params: {
  name: string;
  nodeId?: null | string;
  owner: string;
  aid?: string | null;
}) {
  const base = `/dashboard/repo/${encodeURIComponent(params.owner)}/${encodeURIComponent(
    params.name
  )}/map`;

  return serializeRepoParams(base, {
    node: params.nodeId,
    view: params.nodeId?.startsWith("group:") === true ? params.nodeId : null,
    aid: params.aid,
  });
}

export function buildRepoSearchResultHref(params: {
  name: string;
  owner: string;
  result: RepoSearchResult;
  aid?: string | null;
}) {
  if (params.result.targetView === "docs") {
    return buildRepoDocsHref({
      docType: params.result.docType,
      name: params.name,
      nodeId: params.result.nodeId,
      owner: params.owner,
      section: params.result.docSectionId,
      aid: params.aid,
    });
  }

  if (params.result.targetView === "code") {
    return buildRepoCodeHref({
      name: params.name,
      nodeId: params.result.nodeId,
      owner: params.owner,
      path: params.result.path,
      aid: params.aid,
    });
  }

  return buildRepoMapHref({
    name: params.name,
    nodeId: params.result.nodeId,
    owner: params.owner,
    aid: params.aid,
  });
}
