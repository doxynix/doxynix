import { DocType, type Repo } from "@prisma/client";

import type { AIResult } from "@/server/shared/engine/core/analysis-result.schemas";
import type { RepositoryEvidence } from "@/server/shared/engine/core/discovery.types";
import type { RepoMetrics } from "@/server/shared/engine/core/metrics.types";
import { uniquePaths } from "@/server/shared/lib/array-utils";
import { dumpDebug } from "@/server/shared/lib/debug-logger";

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
import { applyWriterFallbacks } from "./writer-fallbacks";
import {
  executeApiWriter,
  executeArchitectureWriter,
  executeChangelogWriter,
  executeContributingWriter,
  executeReadmeWriter,
  type WriterName,
  type WriterResult,
} from "./writer-tasks";

type WriterTaskKey = "API" | "ARCHITECTURE" | "CHANGELOG" | "CONTRIBUTING" | "README";

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
) {
  const documentationInput = getDocumentationInputSnapshot(evidence, hardMetrics);
  const writerInputs = buildWriterSectionPayloads(documentationInput);
  const sectionDebugSnapshot = buildSectionDebugSnapshot(documentationInput);
  const writerPlan = buildWriterPlanDebugSnapshot(writerInputs, requestedDocs);

  const writerContexts = {
    api: buildStageContextPack({
      files,
      preferredPaths: uniquePaths(documentationInput.sections.api_reference.evidencePaths, 24),
      stage: "writer_api",
    }),
    architecture: buildStageContextPack({
      files,
      preferredPaths: uniquePaths(
        [
          ...documentationInput.sections.architecture.evidencePaths,
          ...documentationInput.sections.risks.evidencePaths,
          ...documentationInput.sections.onboarding.evidencePaths,
        ],
        28
      ),
      stage: "writer_architecture",
    }),
    readme: buildStageContextPack({
      files,
      preferredPaths: uniquePaths(
        [
          ...documentationInput.sections.overview.evidencePaths,
          ...documentationInput.sections.architecture.evidencePaths,
        ],
        24
      ),
      stage: "writer_readme",
    }),
  };

  dumpDebug("writer-budget", buildWriterContextSnapshot(writerContexts));
  dumpDebug("report-section-inputs", {
    sections: sectionDebugSnapshot,
    writerPlan,
  });

  const allowedPathsByWriter = {
    api: buildAllowedPaths(
      [
        ...writerContexts.api.debug.selectedEvidencePaths,
        ...documentationInput.sections.api_reference.evidencePaths,
      ],
      48
    ),
    architecture: buildAllowedPaths(
      [
        ...writerContexts.architecture.debug.selectedEvidencePaths,
        ...documentationInput.sections.architecture.evidencePaths,
        ...documentationInput.sections.risks.evidencePaths,
        ...documentationInput.sections.onboarding.evidencePaths,
      ],
      64
    ),
    readme: buildAllowedPaths(
      [
        ...writerContexts.readme.debug.selectedEvidencePaths,
        ...documentationInput.sections.overview.evidencePaths,
        ...documentationInput.sections.architecture.evidencePaths,
      ],
      48
    ),
  };

  const tasks: Promise<WriterResult>[] = [];
  const taskMap: Partial<Record<WriterTaskKey, number>> = {};

  if (requestedDocs.includes(DocType.README)) {
    taskMap["README"] = tasks.length;
    tasks.push(
      executeReadmeWriter(
        analysisId,
        writerInputs.readme.payload,
        writerContexts.readme.context,
        allowedPathsByWriter.readme,
        language
      )
    );
  }

  if (requestedDocs.includes(DocType.API)) {
    taskMap["API"] = tasks.length;
    tasks.push(
      executeApiWriter(
        analysisId,
        writerInputs.api.payload,
        writerContexts.api.context,
        allowedPathsByWriter.api,
        language
      )
    );
  }

  if (requestedDocs.includes(DocType.ARCHITECTURE)) {
    taskMap["ARCHITECTURE"] = tasks.length;
    tasks.push(
      executeArchitectureWriter(
        analysisId,
        writerInputs.architecture.payload,
        serializeForWriter(documentationInput.sections.risks),
        serializeForWriter(documentationInput.sections.onboarding),
        writerContexts.architecture.context,
        allowedPathsByWriter.architecture,
        language
      )
    );
  }

  if (requestedDocs.includes(DocType.CONTRIBUTING)) {
    taskMap["CONTRIBUTING"] = tasks.length;
    tasks.push(
      executeContributingWriter(
        analysisId,
        writerInputs.contributing.payload,
        writerContexts.readme.context,
        allowedPathsByWriter.readme,
        language
      )
    );
  }

  if (requestedDocs.includes(DocType.CHANGELOG)) {
    taskMap["CHANGELOG"] = tasks.length;
    tasks.push(executeChangelogWriter(analysisId, analysisResult, userId, repo, language));
  }

  const results = await Promise.all(tasks);

  const writerErrors: Partial<Record<WriterName, string>> = {};

  for (const result of results) {
    if (result.error != null) {
      writerErrors[result.name] = result.error;
    }
  }

  const {
    generatedApiMarkdown,
    generatedArchitecture,
    generatedContributing,
    generatedReadme,
    updatedStatus,
    writerFallbacks,
  } = applyWriterFallbacks(results, taskMap, repo, documentationInput, writerErrors);

  let swaggerYaml: string | undefined;
  if (taskMap.API != null && generatedApiMarkdown != null) {
    const yamlMatch = RegExp(/```yaml([\S\s]*?)```/).exec(generatedApiMarkdown);
    if (yamlMatch) {
      swaggerYaml = yamlMatch[1]?.trim();
    }
  }

  let generatedChangelog: string | undefined;
  if (taskMap.CHANGELOG != null) {
    const changelogResult = results[taskMap.CHANGELOG];
    if (changelogResult != null) {
      generatedChangelog = changelogResult.content;
    }
  }

  analysisResult.analysisRuntime = {
    ...analysisResult.analysisRuntime,
    writers: updatedStatus,
  };

  dumpDebug("report-section-docs", {
    generated: {
      api: {
        hasMarkdown: generatedApiMarkdown != null && generatedApiMarkdown.length > 0,
        hasSpec: swaggerYaml != null && swaggerYaml.length > 0,
      },
      architecture: {
        hasMarkdown: generatedArchitecture != null && generatedArchitecture.length > 0,
      },
      primary: {
        apiReady: generatedApiMarkdown != null && generatedApiMarkdown.length > 0,
        architectureReady: generatedArchitecture != null && generatedArchitecture.length > 0,
        readmeReady: generatedReadme != null && generatedReadme.length > 0,
      },
      readme: {
        hasMarkdown: generatedReadme != null && generatedReadme.length > 0,
      },
      secondary: {
        changelogReady: generatedChangelog != null && generatedChangelog.length > 0,
        contributingReady: generatedContributing != null && generatedContributing.length > 0,
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
    writerFallbacks,
    writerPlan,
  });

  dumpDebug("generated-docs-raw", {
    generatedApiMarkdown,
    generatedArchitecture,
    generatedChangelog,
    generatedContributing,
    generatedReadme,
    runtime: analysisResult.analysisRuntime,
    swaggerYaml,
    writerErrors,
    writerFallbacks,
  });

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
