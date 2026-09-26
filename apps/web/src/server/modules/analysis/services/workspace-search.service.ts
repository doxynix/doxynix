import { basename } from "pathe";

import type { DbClient } from "@/server/core/db";
import { normalizeSearchInput, tokenizeSearchInput } from "@/server/utils/search";
import type { RepoSearchResult } from "@/server/utils/types";

import { analysisRepo } from "../analysis.repository";
import { dedupeSearchResults, scoreSearchMatch } from "../analysis.utils";
import { createAnalyzeContextBuilder } from "../logic/analyze-context-builder";
import { coerceAnalysisPayload } from "../logic/payload";
import { DocumentFormatter } from "../logic/section-graph-linker";

export const workspaceSearchService = {
  async search(
    db: DbClient,
    repoId: string,
    search: string,
    aid?: string,
  ): Promise<RepoSearchResult[]> {
    const normalizedSearch = normalizeSearchInput(search);
    const terms = tokenizeSearchInput(search);
    if (normalizedSearch == null || terms.length === 0) {
      return [];
    }

    const repo = await analysisRepo.getRepoSnapshot(db, repoId, aid);
    if (repo == null) {
      return [];
    }
    const analyzeContext = createAnalyzeContextBuilder(repo);
    const structure = analyzeContext.getStructureMap();
    const structureContext = analyzeContext.getEntityContext().structureContext;
    const payload = coerceAnalysisPayload(repo.analyses[0]);

    if (structure == null || structureContext == null || payload == null) {
      return [];
    }

    const docs = await analysisRepo.loadLatestDocumentsWithContent(db, repoId, aid);
    const results: RepoSearchResult[] = [];

    for (const node of structure.graph.nodes) {
      const score = scoreSearchMatch(terms, [node.label, node.path, node.description, node.kind]);
      if (score === 0) {
        continue;
      }

      results.push({
        description: node.description,
        docSectionId: null,
        docType: null,
        id: `node:${node.id}`,
        kind: "node",
        label: node.label,
        nodeId: node.id,
        path: node.path,
        score,
        targetView: "map",
      });
    }

    for (const path of structureContext.allInterestingPaths) {
      const label = basename(path);
      const score = scoreSearchMatch(terms, [label, path]);
      if (score === 0) {
        continue;
      }

      results.push({
        description: path,
        docSectionId: null,
        docType: null,
        id: `file:${path}`,
        kind: "file",
        label,
        nodeId: `file:${path}`,
        path,
        score,
        targetView: "code",
      });
    }

    for (const entrypoint of structure.overview.primaryEntrypoints) {
      const score = scoreSearchMatch(terms, [entrypoint, basename(entrypoint)]);
      if (score === 0) {
        continue;
      }

      results.push({
        description: "Primary entrypoint",
        docSectionId: null,
        docType: null,
        id: `entrypoint:${entrypoint}`,
        kind: "entrypoint",
        label: entrypoint.split("/").pop() ?? entrypoint,
        nodeId: `file:${entrypoint}`,
        path: entrypoint,
        score: score + 5,
        targetView: "code",
      });
    }

    for (const route of payload.metrics.routeInventory?.httpRoutes ?? []) {
      const sourceFile = route.sourcePath;
      const routePattern = route.path;
      const score = scoreSearchMatch(terms, [route.method, routePattern, sourceFile]);
      if (score === 0) {
        continue;
      }

      results.push({
        description: `${route.method} route defined in ${sourceFile}`,
        docSectionId: null,
        docType: null,
        id: `route:${route.method}:${routePattern}:${sourceFile}`,
        kind: "route",
        label: `${route.method} ${routePattern}`,
        nodeId: `file:${sourceFile}`,
        path: sourceFile,
        score: score + 3,
        targetView: "code",
      });
    }

    const graph = structure.graph;
    for (const doc of docs) {
      const formatted = DocumentFormatter.withGraphLinks(doc.content, graph, doc.type, doc.version);
      for (const section of formatted.sections) {
        const score = scoreSearchMatch(terms, [section.title, section.content, doc.type]);
        if (score === 0) {
          continue;
        }

        results.push({
          description: `${doc.type} section`,
          docSectionId: section.id,
          docType: doc.type,
          id: `${doc.publicId}:${section.id}`,
          kind: "doc-section",
          label: section.title,
          nodeId: section.graphNodeIds[0] ?? null,
          path: null,
          score,
          targetView: "docs",
        });
      }
    }

    return dedupeSearchResults(results).sort(
      (left, right) => right.score - left.score || left.label.localeCompare(right.label),
    );
  },
};
