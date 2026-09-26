/**
 * Domain types shared by the web client and the server. The typed tRPC client
 * and the UI read these shapes, so they cannot live under `src/server`.
 */

/** Identity of the analysis run a payload was produced from. */
export type AnalysisRefView = {
  analysisId: string;
  commitSha: null | string;
  createdAt: Date;
};

export type RepoSearchResult = {
  description: string;
  docSectionId: null | string;
  docType: null | string;
  id: string;
  kind: "doc-section" | "entrypoint" | "file" | "node" | "route";
  label: string;
  nodeId: null | string;
  path: null | string;
  score: number;
  targetView: "code" | "docs" | "map";
};
