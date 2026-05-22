import type { RepositoryEvidence } from "../engine/core/discovery.types";
import type { RepoMetrics } from "../engine/core/metrics.types";
import { buildDocumentationInputModel } from "../engine/pipeline/documentation-input";

type DocumentationInputSnapshot = NonNullable<RepoMetrics["documentationInput"]>;

export function getDocumentationInputSnapshot(
  evidence: RepositoryEvidence,
  hardMetrics: RepoMetrics
): DocumentationInputSnapshot {
  return hardMetrics.documentationInput ?? buildDocumentationInputModel(evidence, hardMetrics);
}
