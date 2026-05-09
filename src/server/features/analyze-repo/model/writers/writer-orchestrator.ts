import { DocType, type Repo } from "@prisma/client";
import { batch } from "@trigger.dev/sdk";

import type { AIResult } from "@/server/shared/engine/core/analysis-result.schemas";
import type { RepositoryEvidence } from "@/server/shared/engine/core/discovery.types";
import type { RepoMetrics } from "@/server/shared/engine/core/metrics.types";
import { uniquePaths } from "@/server/shared/lib/array-utils";
import { dumpDebug } from "@/server/shared/lib/debug-logger";
import { hasText } from "@/server/shared/lib/string-utils";
import { taskLogger } from "@/server/shared/lib/task-logger";

import {
  apiTask,
  architectureTask,
  changelogTask,
  contributingTask,
  readmeTask,
} from "../../task/writer.tasks";
import { buildStageContextPack } from "../context-manager";
import {
  buildSectionDebugSnapshot,
  buildWriterContextSnapshot,
  buildWriterPlanDebugSnapshot,
} from "../utils/debug-snapshots";
import { getDocumentationInputSnapshot } from "../utils/input-retrieval";
import {
  buildWriterSectionPayloads,
  serializeAllowedPaths,
  serializeForWriter,
} from "../utils/payload-serialization";
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

const MD_YAML_BLOCK_REGEX = /```(?:yaml)?([\S\s]*?)```/i;

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
  const sectionDebugSnapshot = buildSectionDebugSnapshot(documentationInput);
  const writerPlan = buildWriterPlanDebugSnapshot(writerInputs, requestedDocs);

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
  const engineeringDossierPayload = serializeForWriter(engineeringDossier);
  const engineeringDossierPaths = getEngineeringDossierPaths(engineeringDossier);

  void dumpDebug("writer-budget", buildWriterContextSnapshot(writerContexts));
  void dumpDebug("report-section-inputs", {
    architectureDependencyContext,
    engineeringDossier,
    sections: sectionDebugSnapshot,
    writerPlan,
  });

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

  taskLogger.info(
    `Documentation: Triggering parallel generation for ${requestedDocs.length} assets...`
  );

  const batchDefinitions: any[] = [];

  if (requestedDocs.includes(DocType.README)) {
    batchDefinitions.push({
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
    batchDefinitions.push({
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
    batchDefinitions.push({
      payload: {
        allowedPaths: allowedPathsByWriter.architecture,
        analysisId,
        context: writerContexts.architecture.context,
        engineeringDossierPayload,
        language,
        moduleContext: architectureDependencyContextPayload,
        onboardingPayload: serializeForWriter(documentationInput.sections.onboarding),
        payload: writerInputs.architecture.payload,
        risksPayload: serializeForWriter(documentationInput.sections.risks),
        selectedTokens: writerContexts.architecture.debug.selectedTokens,
        ...authParams,
      },
      task: architectureTask,
    });
  }

  if (requestedDocs.includes(DocType.CONTRIBUTING)) {
    batchDefinitions.push({
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
    batchDefinitions.push({
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

  if (batchDefinitions.length === 0) {
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

  const { runs } = await batch.triggerByTaskAndWait(batchDefinitions);

  const results: WriterResult[] = runs.map((run, index) => {
    const taskName = batchDefinitions[index].task.id.replace("-task", "") as WriterName;

    if (run.ok) {
      taskLogger.success(`Documentation: ${taskName.toUpperCase()} generated successfully`);

      return run.output as WriterResult;
    }

    taskLogger.error(`❌ Documentation: ${taskName.toUpperCase()} failed to generate`);

    return {
      error: run.error instanceof Error ? run.error.message : "Writer task failed",
      name: taskName,
      status: "failed",
    };
  });

  const writerErrors: Partial<Record<WriterName, string>> = {};
  for (const result of results) {
    if (result.error != null) {
      writerErrors[result.name] = result.error;
    }
  }

  const getResult = (name: WriterName) => results.find((r) => r.name === name);

  const readmeRes = getResult("readme");
  const apiRes = getResult("api");
  const archRes = getResult("architecture");
  const contrRes = getResult("contributing");
  const changeRes = getResult("changelog");

  const generatedReadme = readmeRes?.content;
  let generatedApiMarkdown = apiRes?.content;
  const generatedArchitecture = archRes?.content;
  const generatedContributing = contrRes?.content;
  const generatedChangelog = changeRes?.content;

  let swaggerYaml: string | undefined;
  if (apiRes != null && generatedApiMarkdown != null) {
    const yamlMatch = MD_YAML_BLOCK_REGEX.exec(generatedApiMarkdown);
    if (yamlMatch) {
      swaggerYaml = yamlMatch[1]?.trim();
      generatedApiMarkdown = generatedApiMarkdown
        .replace(/# openapi specification[\S\s]*/i, "")
        .trim();
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

  void dumpDebug("report-section-docs", {
    generated: {
      api: {
        hasMarkdown: hasText(generatedApiMarkdown),
        hasSpec: hasText(swaggerYaml),
      },
      architecture: hasText(generatedArchitecture),
      changelog: hasText(generatedChangelog),
      contributing: hasText(generatedContributing),
      readme: hasText(generatedReadme),
      readyStates: {
        api: hasText(generatedApiMarkdown),
        architecture: hasText(generatedArchitecture),
        changelog: hasText(generatedChangelog),
        contributing: hasText(generatedContributing),
        readme: hasText(generatedReadme),
      },
    },
    runtime: analysisResult.analysisRuntime,
    sections: sectionDebugSnapshot,
    writerAllowedPaths: {
      api: JSON.parse(allowedPathsByWriter.api),
      architecture: JSON.parse(allowedPathsByWriter.architecture),
      readme: JSON.parse(allowedPathsByWriter.readme),
    },
    writerErrors,
    writerPlan,
  });

  void dumpDebug("generated-docs-raw", {
    generatedApiMarkdown,
    generatedArchitecture,
    generatedChangelog,
    generatedContributing,
    generatedReadme,
    runtime: analysisResult.analysisRuntime,
    swaggerYaml,
    writerErrors,
  });

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

function buildAllowedPaths(paths: string[], limit: number) {
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
