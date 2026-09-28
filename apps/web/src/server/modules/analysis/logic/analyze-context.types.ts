import type { AnalysisRef, RepoWithLatestAnalysisAndDocs } from "../analysis.repository";
import type {
  NodeExplainPayload,
  StructureContext,
  StructureMapPayload,
  StructureNodePayload,
} from "./structure-shared";

export type AnalyzeEntityContext = {
  analysisRef: AnalysisRef | null;
  repo: RepoWithLatestAnalysisAndDocs;
  structureContext: null | StructureContext;
};

/**
 * The read surface `analysis.mapper` needs, declared as an interface so the mapper can
 * depend on the shape instead of on `createAnalyzeContextBuilder`. Depending on the
 * concrete builder made the mapper a participant in every cycle the builder sits in.
 */
export interface AnalyzeContext {
  getAnalysisRef(): AnalysisRef | null;
  getEntityContext(): AnalyzeEntityContext;
  getNodeExplain(nodeId: string): NodeExplainPayload | null;
  getStructureContext(): null | StructureContext;
  getStructureMap(): null | StructureMapPayload;
  getStructureNode(nodeId: string): StructureNodePayload | null;
}
