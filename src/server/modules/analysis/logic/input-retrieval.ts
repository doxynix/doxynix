import { dumpDebug } from "@/server/utils/debug-logger";

import type { RepositoryEvidence } from "../engine/core/discovery.types";
import type { RepoMetrics } from "../engine/core/metrics.types";
import { buildDocumentationInputModel } from "../engine/pipeline/documentation-input";

type DocumentationInputSnapshot = NonNullable<RepoMetrics["documentationInput"]>;

export function getDocumentationInputSnapshot(
  evidence: RepositoryEvidence,
  hardMetrics: RepoMetrics
): DocumentationInputSnapshot {
  const documentationInput =
    hardMetrics.documentationInput ?? buildDocumentationInputModel(evidence, hardMetrics);

  void dumpDebug("documentation-input-model", {
    model: documentationInput,
    source: hardMetrics.documentationInput != null ? "metrics-cache" : "rebuilt-from-evidence",
  });

  return documentationInput;
}
