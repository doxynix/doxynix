import { DocType, type Repo } from "@prisma/client";
import Bottleneck from "bottleneck";

import type { AIResult } from "@/server/shared/engine/core/analysis-result.schemas";
import type { RepositoryEvidence } from "@/server/shared/engine/core/discovery.types";
import type { RepoMetrics } from "@/server/shared/engine/core/metrics.types";
import { logger } from "@/server/shared/infrastructure/logger";
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
  const limiter = new Bottleneck({
    maxConcurrent: 1,
    minTime: 3000,
    trackDoneStatus: true,
  });

  limiter.on("failed", async (error, jobInfo) => {
    logger.warn({ error, jobInfo, msg: "Job failed, checking for retry" });
    if (jobInfo.retryCount < 2) return 1000;
  });

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

  void dumpDebug("writer-budget", buildWriterContextSnapshot(writerContexts));
  void dumpDebug("report-section-inputs", {
    sections: sectionDebugSnapshot,
    writerPlan,
  });

  const allowedPathsByWriter = {
    api: buildAllowedPaths(
      [
        ...writerContexts.api.debug.selectedEvidencePaths,
        ...documentationInput.sections.api_reference.evidencePaths,
      ],
      480
    ),
    architecture: buildAllowedPaths(
      [
        ...writerContexts.architecture.debug.selectedEvidencePaths,
        ...documentationInput.sections.architecture.evidencePaths,
        ...documentationInput.sections.risks.evidencePaths,
        ...documentationInput.sections.onboarding.evidencePaths,
      ],
      640
    ),
    readme: buildAllowedPaths(
      [
        ...writerContexts.readme.debug.selectedEvidencePaths,
        ...documentationInput.sections.overview.evidencePaths,
        ...documentationInput.sections.architecture.evidencePaths,
      ],
      480
    ),
  };

  const results: WriterResult[] = [];
  const taskMap: Partial<Record<WriterTaskKey, number>> = {};

  const addToQueue = async (key: WriterTaskKey, taskFn: () => Promise<WriterResult>) => {
    taskMap[key] = results.length;
    const result = await limiter.schedule({ id: `${analysisId}-${key}` }, taskFn);
    results.push(result);
  };

  if (requestedDocs.includes(DocType.README)) {
    await addToQueue("README", async () =>
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
    await addToQueue("API", async () =>
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
    await addToQueue("ARCHITECTURE", async () =>
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
    await addToQueue("CONTRIBUTING", async () =>
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
    await addToQueue("CHANGELOG", () =>
      executeChangelogWriter(analysisId, analysisResult, userId, repo, language)
    );
  }

  const writerErrors: Partial<Record<WriterName, string>> = {};

  for (const result of results) {
    if (result.error != null) {
      writerErrors[result.name] = result.error;
    }
  }

  const getResult = (key: WriterTaskKey) => {
    const idx = taskMap[key];
    return idx !== undefined ? results[idx] : null;
  };

  const readmeRes = getResult("README");
  const apiRes = getResult("API");
  const archRes = getResult("ARCHITECTURE");
  const contrRes = getResult("CONTRIBUTING");
  const changeRes = getResult("CHANGELOG");

  const generatedReadme = readmeRes?.content ?? undefined;
  let generatedApiMarkdown = apiRes?.content ?? undefined;
  const generatedArchitecture = archRes?.content ?? undefined;
  const generatedContributing = contrRes?.content ?? undefined;
  const generatedChangelog = changeRes?.content ?? undefined;

  let swaggerYaml: string | undefined;
  if (taskMap.API != null && generatedApiMarkdown != null) {
    const yamlMatch = RegExp(/```yaml([\S\s]*?)```/).exec(generatedApiMarkdown);
    if (yamlMatch) {
      swaggerYaml = yamlMatch[1]?.trim();
      generatedApiMarkdown = generatedApiMarkdown
        .replace(/# OpenAPI Specification[\S\s]*/, "")
        .trim();
    }
  }

  const updatedStatus: any = {
    api: apiRes != null ? (apiRes.error != null ? "failed" : "llm") : "missing",
    architecture: archRes != null ? (archRes.error != null ? "failed" : "llm") : "missing",
    changelog: changeRes != null ? (changeRes.error != null ? "failed" : "llm") : "missing",
    contributing: contrRes != null ? (contrRes.error != null ? "failed" : "llm") : "missing",
    readme: readmeRes != null ? (readmeRes.error != null ? "failed" : "llm") : "missing",
  };

  analysisResult.analysisRuntime = {
    ...analysisResult.analysisRuntime,
    writers: updatedStatus,
  };

  void dumpDebug("report-section-docs", {
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
