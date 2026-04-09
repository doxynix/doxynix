import type { RepositoryEvidence } from "@/server/shared/engine/core/discovery.types";
import type { RepoMetrics } from "@/server/shared/engine/core/metrics.types";
import { buildDocumentationInputModel } from "@/server/shared/engine/pipeline/documentation-input";
import { dumpDebug } from "@/server/shared/lib/debug-logger";

type DocumentationInputSnapshot = NonNullable<RepoMetrics["documentationInput"]>;

export function getDocumentationInputSnapshot(
  evidence: RepositoryEvidence,
  hardMetrics: RepoMetrics
): DocumentationInputSnapshot {
  const documentationInput =
    hardMetrics.documentationInput ?? buildDocumentationInputModel(evidence, hardMetrics);

  dumpDebug("documentation-input-model", {
    model: documentationInput,
    source: hardMetrics.documentationInput != null ? "metrics-cache" : "rebuilt-from-evidence",
  });

  return documentationInput;
}
