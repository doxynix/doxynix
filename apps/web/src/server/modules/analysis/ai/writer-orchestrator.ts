import { DocType } from "@doxynix/shared";
import type { Repo } from "@prisma/client";
import { batch } from "@trigger.dev/sdk";

import { buildDocumentationInputModel } from "@/server/modules/analysis/engine/pipeline/documentation-input";
import { taskLogger } from "@/server/modules/analysis/logic/task-logger";
import { uniquePaths } from "@/server/utils/array-utils";

import type { AIResult } from "../engine/core/analysis-result.schemas";
import type { RepositoryEvidence } from "../engine/core/discovery.types";
import type { RepoMetrics } from "../engine/core/metrics.types";
import { buildStageContextPack } from "../logic/context-manager";
import {
  buildWriterSectionPayloads,
  serializeAllowedPaths,
  toPromptJson,
} from "../logic/payload-serialization";
import {
  apiTask,
  architectureTask,
  changelogTask,
  contributingTask,
  readmeTask,
} from "../tasks/writer.tasks";
import type { WriterName, WriterResult } from "./writer-tasks";

type ModuleDependencyEntry = {
  graphPartial: boolean;
  inbound: string[];
  outbound: string[];
  path: string;
};

type ModuleDependencyContext = {
  graphPartial: boolean;
  modules: ModuleDependencyEntry[];
  resolvedInternalEdges: number;
  unresolvedInternalImports: number;
};

type DocumentationInputSnapshot = NonNullable<RepoMetrics["documentationInput"]>;

/**
 * Maps each writer task id to the `WriterName` it corresponds to. Checked against
 * both key and value types, so adding a writer task without its name (or renaming
 * a `WriterName`) fails to compile here rather than at runtime.
 */
const WRITER_NAME_BY_TASK_ID = {
  "write-api": "api",
  "write-architecture": "architecture",
  "write-changelog": "changelog",
  "write-contributing": "contributing",
  "write-readme": "readme",
} as const satisfies Record<string, WriterName>;

type EngineeringDossier = {
  changeCoupling: NonNullable<RepoMetrics["changeCoupling"]>;
  churnHotspots: NonNullable<RepoMetrics["churnHotspots"]>;
  dependencyCycles: RepoMetrics["dependencyCycles"];
  dependencyHotspots: RepoMetrics["dependencyHotspots"];
  documentationInput: DocumentationInputSnapshot;
  graphReliability: RepositoryEvidence["dependencyGraph"];
  moduleDependencyContext: ModuleDependencyContext;
  mostComplexFiles: RepoMetrics["mostComplexFiles"];
  orphanModules: RepoMetrics["orphanModules"];
  securityFindings: RepoMetrics["securityFindings"];
  teamRoles: RepoMetrics["teamRoles"];
};

export type DeepDocsResult = {
  generatedApiMarkdown?: string;
  generatedArchitecture?: string;
  generatedChangelog?: string;
  generatedContributing?: string;
  generatedReadme?: string;
  swaggerYaml?: string;
};

function compactPayload(val: unknown): unknown {
  if (Array.isArray(val)) {
    const compacted = val
      .map((item) => compactPayload(item))
      .filter(
        (item): item is Exclude<typeof item, null | undefined> =>
          item !== null && item !== undefined && (!Array.isArray(item) || item.length > 0),
      );
    return compacted.length > 0 ? compacted : undefined;
  }

  if (val !== null && typeof val === "object") {
    const obj = val as Record<string, unknown>;
    const cleaned: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      const result = compactPayload(value);
      if (
        result !== null &&
        result !== undefined &&
        (!Array.isArray(result) || result.length > 0) &&
        (typeof result !== "object" || Object.keys(result).length > 0)
      ) {
        cleaned[key] = result;
      }
    }
    return Object.keys(cleaned).length > 0 ? cleaned : undefined;
  }

  return val;
}

export async function orchestrateWriterTasks(
  files: { content: string; path: string }[],
  analysisResult: AIResult,
  evidence: RepositoryEvidence,
  hardMetrics: RepoMetrics,
  analysisId: string,
  requestedDocs: DocType[],
  repo: Repo,
  userId: string,
  language: string,
): Promise<DeepDocsResult> {
  taskLogger.info("Documentation: Preparing high-fidelity context for AI writers...");

  const documentationInput =
    hardMetrics.documentationInput ?? buildDocumentationInputModel(evidence, hardMetrics);
  const writerInputs = buildWriterSectionPayloads(documentationInput);

  const writerContexts = {
    api: await buildStageContextPack({
      files,
      preferredPaths: uniquePaths(documentationInput.sections.api_reference.evidencePaths, 100),
      stage: "writer_api",
    }),
    architecture: await buildStageContextPack({
      files,
      preferredPaths: uniquePaths(
        [
          ...documentationInput.sections.architecture.evidencePaths,
          ...documentationInput.sections.risks.evidencePaths,
          ...documentationInput.sections.onboarding.evidencePaths,
        ],
        280,
      ),
      stage: "writer_architecture",
    }),
    contributing: await buildStageContextPack({
      files,
      preferredPaths: uniquePaths(
        [
          ...documentationInput.codebase.configFiles,
          ...documentationInput.sections.onboarding.body.configPaths,
          ...documentationInput.sections.overview.body.configFiles,
        ],
        120,
      ),
      stage: "writer_contributing",
    }),
    readme: await buildStageContextPack({
      files,
      preferredPaths: uniquePaths(
        [
          ...documentationInput.sections.overview.evidencePaths,
          ...documentationInput.sections.architecture.evidencePaths,
        ],
        240,
      ),
      stage: "writer_readme",
    }),
  };

  const architectureDependencyContext = buildModuleDependencyContext(
    evidence,
    uniquePaths(
      [
        ...documentationInput.sections.architecture.body.primaryEntrypoints,
        ...documentationInput.sections.architecture.body.modules.map((module) => module.path),
        ...documentationInput.sections.architecture.body.dependencyHotspots.map(
          (hotspot) => hotspot.path,
        ),
      ],
      120,
    ),
  );
  const architectureDependencyContextPayload = toPromptJson(architectureDependencyContext);

  const engineeringDossier = buildEngineeringDossier(
    documentationInput,
    hardMetrics,
    evidence,
    architectureDependencyContext,
  );

  const engineeringDossierPaths = getEngineeringDossierPaths(engineeringDossier);

  // `structuredClone<T>` already returns a deep copy of the dossier, so no cast is
  // needed. The three `edges` fields below are real: `graphReliability` and
  // `documentationInput.architecture.graphReliability` both exist on the snapshot.
  const strippedDossier = structuredClone(engineeringDossier);

  strippedDossier.graphReliability.edges = [];
  strippedDossier.documentationInput.architecture.graphReliability.edges = [];

  // `documentationInput.sections` is required on the snapshot, and every read of it
  // happens above, before the strip. The strip therefore produces a genuinely
  // smaller object, described by its own type rather than by lying about
  // `EngineeringDossier` with `as unknown as Record<string, unknown>`.
  const { sections: _sections, ...documentationInputWithoutSections } =
    strippedDossier.documentationInput;
  const dossierForPrompt: Omit<EngineeringDossier, "documentationInput"> & {
    documentationInput: Omit<DocumentationInputSnapshot, "sections">;
  } = {
    ...strippedDossier,
    documentationInput: documentationInputWithoutSections,
  };

  const compressedDossier = compactPayload(dossierForPrompt);
  const engineeringDossierPayload = JSON.stringify(compressedDossier);

  const allowedPathsByWriter = {
    api: buildAllowedPaths(
      [
        ...writerContexts.api.debug.selectedEvidencePaths,
        ...documentationInput.sections.api_reference.evidencePaths,
        ...engineeringDossierPaths,
      ],
      360,
    ),
    architecture: buildAllowedPaths(
      [
        ...writerContexts.architecture.debug.selectedEvidencePaths,
        ...documentationInput.sections.architecture.evidencePaths,
        ...documentationInput.sections.risks.evidencePaths,
        ...documentationInput.sections.onboarding.evidencePaths,
        ...engineeringDossierPaths,
      ],
      420,
    ),
    contributing: buildAllowedPaths(
      [
        ...writerContexts.contributing.debug.selectedEvidencePaths,
        ...documentationInput.sections.onboarding.body.configPaths,
        ...documentationInput.sections.onboarding.body.riskPaths,
        ...documentationInput.sections.risks.evidencePaths,
        ...engineeringDossierPaths,
      ],
      240,
    ),
    readme: buildAllowedPaths(
      [
        ...writerContexts.readme.debug.selectedEvidencePaths,
        ...documentationInput.sections.overview.evidencePaths,
        ...documentationInput.sections.architecture.evidencePaths,
        ...documentationInput.sections.onboarding.evidencePaths,
        ...engineeringDossierPaths,
      ],
      180,
    ),
  };

  const authParams = {
    branch: repo.defaultBranch,
    repoId: repo.id,
    userId,
  };

  const queueOptions = {
    concurrencyKey: `user-writers-${userId}`,
  };

  const batchJobs = [];

  if (requestedDocs.includes(DocType.README)) {
    batchJobs.push({
      options: queueOptions,
      payload: {
        allowedPaths: allowedPathsByWriter.readme,
        analysisId,
        context: writerContexts.readme.context,
        engineeringDossierPayload,
        language,
        payload: writerInputs.readme.payload,
        selectedTokens: writerContexts.readme.debug.selectedTokens,
        ...authParams,
      },
      task: readmeTask,
    });
  }

  if (requestedDocs.includes(DocType.API)) {
    batchJobs.push({
      options: queueOptions,
      payload: {
        allowedPaths: allowedPathsByWriter.api,
        analysisId,
        context: writerContexts.api.context,
        engineeringDossierPayload,
        language,
        payload: writerInputs.api.payload,
        selectedTokens: writerContexts.api.debug.selectedTokens,
        ...authParams,
      },
      task: apiTask,
    });
  }

  if (requestedDocs.includes(DocType.ARCHITECTURE)) {
    const moduleContext = architectureDependencyContextPayload;
    const onboardingPayload = toPromptJson(documentationInput.sections.onboarding);
    const risksPayload = toPromptJson(documentationInput.sections.risks);
    batchJobs.push({
      options: queueOptions,
      payload: {
        allowedPaths: allowedPathsByWriter.architecture,
        analysisId,
        context: writerContexts.architecture.context,
        engineeringDossierPayload,
        language,
        moduleContext,
        onboardingPayload,
        payload: writerInputs.architecture.payload,
        risksPayload,
        selectedTokens: writerContexts.architecture.debug.selectedTokens,
        ...authParams,
      },
      task: architectureTask,
    });
  }

  if (requestedDocs.includes(DocType.CONTRIBUTING)) {
    batchJobs.push({
      options: queueOptions,
      payload: {
        allowedPaths: allowedPathsByWriter.contributing,
        analysisId,
        context: writerContexts.contributing.context,
        engineeringDossierPayload,
        language,
        payload: writerInputs.contributing.payload,
        selectedTokens: writerContexts.contributing.debug.selectedTokens,
        ...authParams,
      },
      task: contributingTask,
    });
  }

  if (requestedDocs.includes(DocType.CHANGELOG)) {
    batchJobs.push({
      options: queueOptions,
      payload: {
        analysisId,
        analysisResult,
        language,
        repo,
        userId,
      },
      task: changelogTask,
    });
  }

  if (batchJobs.length === 0) {
    taskLogger.warn("Documentation: No assets requested for generation");

    return {
      generatedApiMarkdown: undefined,
      generatedArchitecture: undefined,
      generatedChangelog: undefined,
      generatedContributing: undefined,
      generatedReadme: undefined,
      swaggerYaml: undefined,
    };
  }

  taskLogger.info(
    `Documentation: Fan-out triggering ${batchJobs.length} writers in parallel via batching...`,
  );

  const { runs } = await batch.triggerByTaskAndWait(batchJobs);

  const getOutput = (
    taskInstance:
      | typeof apiTask
      | typeof architectureTask
      | typeof changelogTask
      | typeof contributingTask
      | typeof readmeTask,
  ): WriterResult | undefined => {
    const run = runs.find((r) => r.taskIdentifier === taskInstance.id);
    if (run == null) {
      return;
    }

    if (run.ok) {
      return run.output;
    }

    return {
      // `WriterResult["error"]` is `string | undefined`, so a non-`Error` rejection
      // reason is normalized to `undefined` rather than `null`.
      error: run.error instanceof Error ? run.error.message : undefined,
      // The map is exhaustive over the five task ids, so the index is total —
      // `noUncheckedIndexedAccess` widens it to `| undefined` but the lookup
      // cannot actually miss.
      name: WRITER_NAME_BY_TASK_ID[taskInstance.id],
      status: "failed" as const,
    };
  };

  const readmeRes = getOutput(readmeTask);
  const apiRes = getOutput(apiTask);
  const archRes = getOutput(architectureTask);
  const contrRes = getOutput(contributingTask);
  const changeRes = getOutput(changelogTask);

  const generatedReadme = readmeRes?.content;
  let generatedApiMarkdown = apiRes?.content;
  const generatedArchitecture = archRes?.content;
  const generatedContributing = contrRes?.content;
  const generatedChangelog = changeRes?.content;

  let swaggerYaml: string | undefined;
  if (apiRes != null && generatedApiMarkdown != null) {
    const specHeaderIndex = generatedApiMarkdown.search(/#\s+openapi\s+specification/i);

    if (specHeaderIndex !== -1) {
      const specPart = generatedApiMarkdown.slice(specHeaderIndex);
      const lowerSpecPart = specPart.toLowerCase();

      let blockStart = lowerSpecPart.indexOf("```yaml");
      let offset = 7;
      if (blockStart === -1) {
        blockStart = lowerSpecPart.indexOf("```yml");
        offset = 6;
      }

      if (blockStart !== -1) {
        const blockEnd = specPart.indexOf("```", blockStart + offset);

        if (blockEnd !== -1) {
          swaggerYaml = specPart.slice(blockStart + offset, blockEnd).trim();

          generatedApiMarkdown = (
            generatedApiMarkdown.slice(0, specHeaderIndex) +
            specPart.slice(0, blockStart) +
            specPart.slice(blockEnd + 3)
          ).trim();
        }
      }
    }
  }

  analysisResult.analysisRuntime = {
    ...analysisResult.analysisRuntime,
    writers: {
      api: apiRes?.status ?? "missing",
      architecture: archRes?.status ?? "missing",
      changelog: changeRes?.status ?? "missing",
      contributing: contrRes?.status ?? "missing",
      readme: readmeRes?.status ?? "missing",
    },
  };

  const resultsList = [readmeRes, apiRes, archRes, contrRes, changeRes].filter(
    (r): r is NonNullable<typeof r> => r != null,
  );

  const writerErrors: Partial<Record<WriterName, string>> = {};
  for (const result of resultsList) {
    if (result.error != null) {
      writerErrors[result.name] = result.error;
    }
  }

  taskLogger.success("Documentation: All tasks finished");

  return {
    generatedApiMarkdown,
    generatedArchitecture,
    generatedChangelog,
    generatedContributing,
    generatedReadme,
    swaggerYaml,
  };
}

function buildAllowedPaths(paths: string[], limit: number): string {
  return serializeAllowedPaths(uniquePaths(paths, limit));
}

function buildModuleDependencyContext(
  evidence: RepositoryEvidence,
  modulePaths: string[],
): ModuleDependencyContext {
  const graphPartial = evidence.dependencyGraph.unresolvedImportSpecifiers > 0;
  const inboundByPath = new Map<string, string[]>();
  const outboundByPath = new Map<string, string[]>();

  for (const edge of evidence.dependencyGraph.edges) {
    if (!isResolvedInternalEdge(edge)) {
      continue;
    }

    const outbound = outboundByPath.get(edge.fromPath) ?? [];
    outbound.push(edge.toPath);
    outboundByPath.set(edge.fromPath, outbound);

    const inbound = inboundByPath.get(edge.toPath) ?? [];
    inbound.push(edge.fromPath);
    inboundByPath.set(edge.toPath, inbound);
  }

  return {
    graphPartial,
    modules: modulePaths.map((path) => ({
      graphPartial,
      inbound: uniquePaths(inboundByPath.get(path) ?? [], 16),
      outbound: uniquePaths(outboundByPath.get(path) ?? [], 16),
      path,
    })),
    resolvedInternalEdges: evidence.dependencyGraph.resolvedEdges,
    unresolvedInternalImports: evidence.dependencyGraph.unresolvedImportSpecifiers,
  };
}

function getDependencyContextPaths(context: ModuleDependencyContext): string[] {
  return uniquePaths(
    context.modules.flatMap((module) => [module.path, ...module.inbound, ...module.outbound]),
    240,
  );
}

function buildEngineeringDossier(
  documentationInput: DocumentationInputSnapshot,
  hardMetrics: RepoMetrics,
  evidence: RepositoryEvidence,
  moduleDependencyContext: ModuleDependencyContext,
): EngineeringDossier {
  return {
    changeCoupling: hardMetrics.changeCoupling ?? [],
    churnHotspots: hardMetrics.churnHotspots ?? [],
    dependencyCycles: hardMetrics.dependencyCycles,
    dependencyHotspots: hardMetrics.dependencyHotspots,
    documentationInput,
    graphReliability: {
      ...evidence.dependencyGraph,
      resolvedEdges:
        hardMetrics.graphReliability?.resolvedEdges ?? evidence.dependencyGraph.resolvedEdges,
      unresolvedImportSpecifiers:
        hardMetrics.graphReliability?.unresolvedImportSpecifiers ??
        evidence.dependencyGraph.unresolvedImportSpecifiers,
      unresolvedSamples:
        hardMetrics.graphReliability?.unresolvedSamples ??
        evidence.dependencyGraph.unresolvedSamples,
    },
    moduleDependencyContext,
    mostComplexFiles: hardMetrics.mostComplexFiles,
    orphanModules: hardMetrics.orphanModules,
    securityFindings: hardMetrics.securityFindings,
    teamRoles: hardMetrics.teamRoles,
  };
}

function getEngineeringDossierPaths(dossier: EngineeringDossier): string[] {
  return uniquePaths(
    [
      ...getDependencyContextPaths(dossier.moduleDependencyContext),
      ...Object.values(dossier.documentationInput.sections).flatMap(
        (section) => section.evidencePaths,
      ),
      ...dossier.documentationInput.report.primaryEntrypoints,
      ...dossier.documentationInput.report.secondaryEntrypoints,
      ...dossier.documentationInput.codebase.configFiles,
      ...dossier.documentationInput.api.publicSurfacePaths,
      ...dossier.documentationInput.api.routeInventory.sourceFiles,
      ...dossier.securityFindings.map((finding) => finding.path),
      ...dossier.churnHotspots.map((hotspot) => hotspot.path),
      ...dossier.changeCoupling.flatMap((coupling) => [coupling.fromPath, coupling.toPath]),
      ...dossier.dependencyHotspots.map((hotspot) => hotspot.path),
      ...dossier.dependencyCycles.flat(),
      ...dossier.orphanModules,
      ...dossier.mostComplexFiles,
    ],
    640,
  );
}

function isResolvedInternalEdge(
  edge: RepositoryEvidence["dependencyGraph"]["edges"][number],
): edge is RepositoryEvidence["dependencyGraph"]["edges"][number] & { toPath: string } {
  return edge.kind === "internal" && edge.resolved && edge.toPath != null;
}
