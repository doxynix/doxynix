import type { RepoWorkspacePayload } from "@/server/utils/types";

import type { analysisMapper } from "../analysis.mapper";
import type { StructureMapPayload } from "./graph-navigator";

type RepoOverview = NonNullable<ReturnType<typeof analysisMapper.toOverview>>;

/**
 * Projects the raw analysis overview and structure map into the flat payload the
 * workspace screen consumes. Pure projection: no field of either input is
 * dropped, and `source` is narrowed to the only value the UI understands.
 */
export function buildWorkspacePayload(params: {
  overview: RepoOverview;
  structure: StructureMapPayload;
}): RepoWorkspacePayload {
  const { overview, structure } = params;

  return {
    analysisRef: structure.analysisRef,
    docs: {
      availableCount: overview.docs.availableCount,
      availableTypes: overview.docs.availableTypes,
      hasSwagger: overview.docs.hasSwagger,
      items: overview.docs.items.map((item) => ({
        id: item.id,
        source: item.source === "llm" ? "llm" : null,
        status: item.status,
        type: item.type,
        updatedAt: item.updatedAt,
        version: item.version,
      })),
    },
    mostComplexFiles: overview.mostComplexFiles,
    navigation: {
      defaultNodeId: structure.selection.defaultNodeId,
      keyZones: structure.graph.nodes,
      primaryEntrypoints: structure.overview.primaryEntrypoints,
      primaryModules: structure.overview.primaryModules,
    },
    repo: {
      defaultBranch: overview.repo.defaultBranch,
      description: overview.repo.description,
      forks: overview.repo.forks,
      id: overview.repo.id,
      language: overview.repo.language,
      languageColor: overview.repo.languageColor,
      license: overview.repo.license,
      name: overview.repo.name,
      openIssues: overview.repo.openIssues,
      owner: overview.repo.owner,
      ownerAvatarUrl: overview.repo.ownerAvatarUrl,
      pushedAt: overview.repo.pushedAt,
      size: overview.repo.size,
      stars: overview.repo.stars,
      topics: overview.repo.topics,
      url: overview.repo.url,
      visibility: overview.repo.visibility,
    },
    secondary: {
      languages: overview.languages,
      scores: overview.scores,
      signals: overview.signals,
      stats: overview.stats,
    },
    summary: {
      architectureStyle: structure.overview.architectureStyle,
      maintenance: overview.maintenance,
      purpose: structure.overview.purpose,
      repositoryKind: structure.overview.repositoryKind,
      stack: structure.overview.stack,
    },
    topRisks: overview.topRisks.map((risk) => ({
      id: risk.id,
      severity: risk.severity,
      suggestedNextChange: risk.suggestedNextChange,
      summary: risk.summary,
      title: risk.title,
    })),
  };
}
