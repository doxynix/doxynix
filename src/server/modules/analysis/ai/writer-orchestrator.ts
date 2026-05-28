import { DocType, type Repo } from "@prisma/client";
import { batch } from "@trigger.dev/sdk";

import { taskLogger } from "@/server/modules/analysis/logic/task-logger";
import { uniquePaths } from "@/server/utils/array-utils";

import type { AIResult } from "../engine/core/analysis-result.schemas";
import type { RepositoryEvidence } from "../engine/core/discovery.types";
import type { RepoMetrics } from "../engine/core/metrics.types";
import { buildStageContextPack } from "../logic/context-manager";
import { getDocumentationInputSnapshot } from "../logic/input-retrieval";
import {
  buildWriterSectionPayloads,
  serializeAllowedPaths,
  serializeForWriter,
} from "../logic/payload-serialization";
import {
  apiTask,
  architectureTask,
  changelogTask,
  contributingTask,
  readmeTask,
} from "../tasks/writer.tasks";
import { type WriterName, type WriterResult } from "./writer-tasks";

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
          item !== null && item !== undefined && (!Array.isArray(item) || item.length > 0)
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
  userId: number,
  language: string
): Promise<DeepDocsResult> {
  taskLogger.info("Documentation: Preparing high-fidelity context for AI writers...");

  const documentationInput = getDocumentationInputSnapshot(evidence, hardMetrics);
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
        280
      ),
      stage: "writer_architecture",
    }),
    readme: await buildStageContextPack({
      files,
      preferredPaths: uniquePaths(
        [
          ...documentationInput.sections.overview.evidencePaths,
          ...documentationInput.sections.architecture.evidencePaths,
        ],
        240
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
          (hotspot) => hotspot.path
        ),
      ],
      120
    )
  );
  const architectureDependencyContextPayload = serializeForWriter(architectureDependencyContext);

  const engineeringDossier = buildEngineeringDossier(
    documentationInput,
    hardMetrics,
    evidence,
    architectureDependencyContext
  );

  const engineeringDossierPaths = getEngineeringDossierPaths(engineeringDossier);

  const strippedDossier = structuredClone(engineeringDossier) as unknown as Record<string, unknown>;

  if (
    strippedDossier.graphReliability != null &&
    typeof strippedDossier.graphReliability === "object"
  ) {
    (strippedDossier.graphReliability as Record<string, unknown>).edges = [];
  }

  if (
    strippedDossier.documentationInput != null &&
    typeof strippedDossier.documentationInput === "object"
  ) {
    const docInput = strippedDossier.documentationInput as Record<string, unknown>;
    docInput.sections = undefined;

    if (docInput.architecture != null && typeof docInput.architecture === "object") {
      const arch = docInput.architecture as Record<string, unknown>;
      if (arch.graphReliability != null && typeof arch.graphReliability === "object") {
        (arch.graphReliability as Record<string, unknown>).edges = [];
      }
    }

    if (docInput.risks != null && typeof docInput.risks === "object") {
      const risks = docInput.risks as Record<string, unknown>;
      if (risks.graphReliability != null && typeof risks.graphReliability === "object") {
        (risks.graphReliability as Record<string, unknown>).edges = [];
      }
    }
  }

  const compressedDossier = compactPayload(strippedDossier);
  const engineeringDossierPayload = serializeForWriter(compressedDossier);

  const allowedPathsByWriter = {
    api: buildAllowedPaths(
      [
        ...engineeringDossierPaths,
        ...writerContexts.api.debug.selectedEvidencePaths,
        ...documentationInput.sections.api_reference.evidencePaths,
      ],
      640
    ),
    architecture: buildAllowedPaths(
      [
        ...engineeringDossierPaths,
        ...writerContexts.architecture.debug.selectedEvidencePaths,
        ...documentationInput.sections.architecture.evidencePaths,
        ...documentationInput.sections.risks.evidencePaths,
        ...documentationInput.sections.onboarding.evidencePaths,
      ],
      640
    ),
    readme: buildAllowedPaths(
      [
        ...engineeringDossierPaths,
        ...writerContexts.readme.debug.selectedEvidencePaths,
        ...documentationInput.sections.overview.evidencePaths,
        ...documentationInput.sections.architecture.evidencePaths,
      ],
      480
    ),
  };

  const authParams = {
    branch: repo.defaultBranch,
    repoId: repo.publicId,
    userId,
  };

  const batchJobs = [];

  if (requestedDocs.includes(DocType.README)) {
    batchJobs.push({
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
    const onboardingPayload = serializeForWriter(documentationInput.sections.onboarding);
    const risksPayload = serializeForWriter(documentationInput.sections.risks);
    batchJobs.push({
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
      payload: {
        allowedPaths: allowedPathsByWriter.readme,
        analysisId,
        context: writerContexts.readme.context,
        engineeringDossierPayload,
        language,
        payload: writerInputs.contributing.payload,
        selectedTokens: writerContexts.readme.debug.selectedTokens,
        ...authParams,
      },
      task: contributingTask,
    });
  }

  if (requestedDocs.includes(DocType.CHANGELOG)) {
    batchJobs.push({
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
    `Documentation: Fan-out triggering ${batchJobs.length} writers in parallel via batching...`
  );

  const { runs } = await batch.triggerByTaskAndWait(batchJobs);

  const getOutput = (
    taskInstance:
      | typeof apiTask
      | typeof architectureTask
      | typeof changelogTask
      | typeof contributingTask
      | typeof readmeTask
  ) => {
    const run = runs.find((r) => r.taskIdentifier === taskInstance.id);
    if (run == null) return;

    if (run.ok) {
      return run.output as WriterResult;
    }

    return {
      error: run.error instanceof Error ? run.error.message : null,
      name: taskInstance.id.replace("write-", "") as WriterName,
      status: "failed" as const,
    } as WriterResult;
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
    (r): r is NonNullable<typeof r> => r != null
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
  modulePaths: string[]
): ModuleDependencyContext {
  const graphPartial = evidence.dependencyGraph.unresolvedImportSpecifiers > 0;
  const inboundByPath = new Map<string, string[]>();
  const outboundByPath = new Map<string, string[]>();

  for (const edge of evidence.dependencyGraph.edges) {
    if (!isResolvedInternalEdge(edge)) continue;

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
    640
  );
}

function buildEngineeringDossier(
  documentationInput: DocumentationInputSnapshot,
  hardMetrics: RepoMetrics,
  evidence: RepositoryEvidence,
  moduleDependencyContext: ModuleDependencyContext
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
        (section) => section.evidencePaths
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
    640
  );
}

function isResolvedInternalEdge(
  edge: RepositoryEvidence["dependencyGraph"]["edges"][number]
): edge is RepositoryEvidence["dependencyGraph"]["edges"][number] & { toPath: string } {
  return edge.kind === "internal" && edge.resolved && edge.toPath != null;
}
