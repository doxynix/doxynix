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

// Declared as an interface so the mapper depends on the shape, not on `createAnalyzeContextBuilder` (avoids dependency cycles)
export interface AnalyzeContext {
  getAnalysisRef(): AnalysisRef | null;
  getEntityContext(): AnalyzeEntityContext;
  getNodeExplain(nodeId: string): NodeExplainPayload | null;
  getStructureContext(): null | StructureContext;
  getStructureMap(): null | StructureMapPayload;
  getStructureNode(nodeId: string): StructureNodePayload | null;
}
