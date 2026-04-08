import {
  toAnalysisRef,
  type AnalysisRef,
  type RepoWithLatestAnalysisAndDocs,
} from "@/server/shared/infrastructure/repo-snapshots";

import {
  buildStructureMapPayloadFromContext,
  buildStructureNodePayloadFromContext,
  type StructureMapPayload,
  type StructureNodePayload,
} from "./graph-navigator";
import { buildNodeExplainPayloadFromContext, type NodeExplainPayload } from "./node-explainer";
import { buildStructureContext } from "./structure-context";
import type { StructureContext } from "./structure-shared";

export type AnalyzeEntityContext = {
  analysisRef: AnalysisRef | null;
  repo: RepoWithLatestAnalysisAndDocs;
  structureContext: StructureContext | null;
};

export class AnalyzeContextBuilder {
  private readonly analysisRef: AnalysisRef | null;
  private readonly explainByNodeId = new Map<string, NodeExplainPayload | null>();
  private readonly nodeById = new Map<string, StructureNodePayload | null>();
  private structureContext: StructureContext | null | undefined;
  private structureMap: StructureMapPayload | null | undefined;

  constructor(private readonly repo: RepoWithLatestAnalysisAndDocs) {
    this.analysisRef = toAnalysisRef(repo.analyses[0]);
  }

  getAnalysisRef() {
    return this.analysisRef;
  }

  getEntityContext(): AnalyzeEntityContext {
    return {
      analysisRef: this.analysisRef,
      repo: this.repo,
      structureContext: this.getStructureContext(),
    };
  }

  getStructureContext() {
    if (this.structureContext === undefined) {
      this.structureContext = buildStructureContext(this.repo);
    }

    return this.structureContext;
  }

  getStructureMap() {
    if (this.structureMap === undefined) {
      const context = this.getStructureContext();
      this.structureMap =
        context == null ? null : buildStructureMapPayloadFromContext(context, this.analysisRef);
    }

    return this.structureMap;
  }

  getStructureNode(nodeId: string) {
    if (!this.nodeById.has(nodeId)) {
      const context = this.getStructureContext();
      this.nodeById.set(
        nodeId,
        context == null
          ? null
          : buildStructureNodePayloadFromContext(context, this.analysisRef, nodeId)
      );
    }

    return this.nodeById.get(nodeId) ?? null;
  }

  getNodeExplain(nodeId: string) {
    if (!this.explainByNodeId.has(nodeId)) {
      const context = this.getStructureContext();
      const structureNode = this.getStructureNode(nodeId);
      this.explainByNodeId.set(
        nodeId,
        context == null || structureNode == null
          ? null
          : buildNodeExplainPayloadFromContext(context, this.analysisRef, nodeId, structureNode)
      );
    }

    return this.explainByNodeId.get(nodeId) ?? null;
  }
}

export function createAnalyzeContextBuilder(repo: RepoWithLatestAnalysisAndDocs) {
  return new AnalyzeContextBuilder(repo);
}
