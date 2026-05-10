import { google, type GoogleLanguageModelOptions } from "@ai-sdk/google";
import type { Repo } from "@prisma/client";
import type { ToolSet } from "ai";

import type { appLogger } from "@/server/core/app-logger";
import type { prisma } from "@/server/core/db";
import { getClientContext } from "@/server/core/github/github-provider";
import { callWithFallback } from "@/server/utils/call";
import { unwrapAiText } from "@/server/utils/optimizers";

import type { AIResult } from "../engine/core/analysis-result.schemas";
import { AI_MODELS, SAFETY_SETTINGS } from "./ai-constants";
import type { buildRepositoryTools } from "./ai-tools";
import {
  API_WRITER_SYSTEM_PROMPT,
  API_WRITER_USER_PROMPT,
  ARCHITECTURE_WRITER_SYSTEM_PROMPT,
  ARCHITECTURE_WRITER_USER_PROMPT,
  CHANGELOG_WRITER_SYSTEM_PROMPT,
  CHANGELOG_WRITER_USER_PROMPT,
  CONTRIBUTING_WRITER_SYSTEM_PROMPT,
  CONTRIBUTING_WRITER_USER_PROMPT,
  README_WRITER_SYSTEM_PROMPT,
  README_WRITER_USER_PROMPT,
} from "./prompts-refactored";

export type WriterName = "api" | "architecture" | "changelog" | "contributing" | "readme";
export type WriterStatus = "failed" | "llm" | "missing";
export type WriterResult = {
  content?: string;
  error?: string;
  name: WriterName;
  status: WriterStatus;
};
type WriterPhase =
  | "writer_api"
  | "writer_architecture"
  | "writer_changelog"
  | "writer_contributing"
  | "writer_readme";

async function runWriterTask(
  name: WriterResult["name"],
  runner: () => Promise<string>
): Promise<WriterResult> {
  try {
    const content = await runner();
    return {
      content,
      name,
      status: content.length > 0 ? "llm" : "missing",
    };
  } catch (error) {
    appLogger.warn({
      error,
      msg: "Writer stage failed; continuing with partial docs",
      writer: name,
    });
    return {
      error: error instanceof Error ? error.message : String(error),
      name,
      status: "failed",
    };
  }
}

type RunWriterPromptParams = {
  analysisId: string;
  name: WriterResult["name"];
  phase: WriterPhase;
  prompt: string;
  promptChars?: number;
  providerOptions?: { google: GoogleLanguageModelOptions };
  system: string;
  temperature?: number;
  tools?: ToolSet;
};

async function runWriterPrompt(params: RunWriterPromptParams) {
  const defaultProviderOptions = {
    google: { safetySettings: SAFETY_SETTINGS },
  };

  return runWriterTask(
    params.name,
    async () =>
      await callWithFallback<string>({
        attemptMetadata: {
          analysisId: params.analysisId,
          phase: params.phase,
          ...(params.promptChars != null ? { promptChars: params.promptChars } : {}),
        },
        models: AI_MODELS.WRITER,
        outputSchema: null,
        prompt: params.prompt,
        system: params.system,
        ...(params.providerOptions != null ? { providerOptions: params.providerOptions } : {}),
        providerOptions: params.providerOptions ?? defaultProviderOptions,
        taskType: "creative",
        temperature: params.temperature,
        tools: {
          ...params.tools,
          codeExecution: google.tools.codeExecution({}),
        },
      }).then(unwrapAiText)
  );
}

export async function executeReadmeWriter(
  analysisId: string,
  payload: string,
  engineeringDossierPayload: string,
  context: string,
  allowedPaths: string,
  language: string,
  repoId: string,
  userId: number,
  branch: string
): Promise<WriterResult> {
  return runWriterPrompt({
    analysisId,
    name: "readme",
    phase: "writer_readme",
    prompt: README_WRITER_USER_PROMPT(payload, engineeringDossierPayload, context, allowedPaths),
    promptChars: payload.length + engineeringDossierPayload.length + context.length,
    system: README_WRITER_SYSTEM_PROMPT(language),
    tools: buildRepositoryTools(userId, repoId, branch),
  });
}

export async function executeApiWriter(
  analysisId: string,
  payload: string,
  engineeringDossierPayload: string,
  context: string,
  allowedPaths: string,
  language: string,
  repoId: string,
  userId: number,
  branch: string
): Promise<WriterResult> {
  return runWriterPrompt({
    analysisId,
    name: "api",
    phase: "writer_api",
    prompt: API_WRITER_USER_PROMPT(payload, engineeringDossierPayload, context, allowedPaths),
    promptChars: payload.length + engineeringDossierPayload.length + context.length,
    system: API_WRITER_SYSTEM_PROMPT(language),
    tools: buildRepositoryTools(userId, repoId, branch),
  });
}

export async function executeArchitectureWriter(
  analysisId: string,
  payload: string,
  risksPayload: string,
  onboardingPayload: string,
  moduleDependencyContextPayload: string,
  engineeringDossierPayload: string,
  context: string,
  allowedPaths: string,
  language: string,
  repoId: string,
  userId: number,
  branch: string
): Promise<WriterResult> {
  return runWriterPrompt({
    analysisId,
    name: "architecture",
    phase: "writer_architecture",
    prompt: ARCHITECTURE_WRITER_USER_PROMPT(
      payload,
      risksPayload,
      onboardingPayload,
      moduleDependencyContextPayload,
      engineeringDossierPayload,
      context,
      allowedPaths
    ),
    promptChars:
      payload.length +
      moduleDependencyContextPayload.length +
      engineeringDossierPayload.length +
      context.length,
    system: ARCHITECTURE_WRITER_SYSTEM_PROMPT(language),
    tools: buildRepositoryTools(userId, repoId, branch),
  });
}

export async function executeContributingWriter(
  analysisId: string,
  payload: string,
  engineeringDossierPayload: string,
  context: string,
  allowedPaths: string,
  language: string,
  repoId: string,
  userId: number,
  branch: string
): Promise<WriterResult> {
  return runWriterPrompt({
    analysisId,
    name: "contributing",
    phase: "writer_contributing",
    prompt: CONTRIBUTING_WRITER_USER_PROMPT(
      payload,
      engineeringDossierPayload,
      context,
      allowedPaths
    ),
    promptChars: payload.length + engineeringDossierPayload.length + context.length,
    system: CONTRIBUTING_WRITER_SYSTEM_PROMPT(language),
    tools: buildRepositoryTools(userId, repoId, branch),
  });
}

export async function executeChangelogWriter(
  analysisId: string,
  analysisResult: AIResult,
  userId: number,
  repo: Repo,
  language: string
): Promise<WriterResult> {
  const changelogContext: any = {
    commits: [],
    diff_summary: {
      files_changed: 0,
      top_modified_files: [],
    },
  };

  try {
    const { octokit } = await getClientContext(prisma, userId, repo.owner);

    const previousAnalysis = await prisma.analysis.findFirst({
      orderBy: { createdAt: "desc" },
      where: {
        publicId: { not: analysisId },
        repoId: repo.id,
        status: "DONE",
      },
    });

    if (previousAnalysis?.commitSha != null) {
      const { data: compareData } = await octokit.rest.repos.compareCommits({
        base: previousAnalysis.commitSha,
        head: repo.defaultBranch,
        owner: repo.owner,
        repo: repo.name,
      });

      changelogContext.commits = compareData.commits.map((c) => ({
        author: c.commit.author?.name,
        files: c.files?.map((f) => f.filename).slice(0, 10),
        message: c.commit.message,
      }));

      changelogContext.diff_summary = {
        files_changed: compareData.files?.length ?? 0,
        top_modified_files: compareData.files
          ?.sort((a, b) => b.changes - a.changes)
          .slice(0, 15)
          .map((f) => f.filename),
      };
    } else {
      const { data: commitsData } = await octokit.rest.repos.listCommits({
        owner: repo.owner,
        per_page: 30,
        repo: repo.name,
      });

      const detailedCommits = await Promise.all(
        commitsData.slice(0, 15).map(async (c) => {
          const { data: detail } = await octokit.rest.repos.getCommit({
            owner: repo.owner,
            ref: c.sha,
            repo: repo.name,
          });
          return {
            author: detail.commit.author?.name,
            files: detail.files?.map((f) => f.filename).slice(0, 5),
            message: detail.commit.message,
          };
        })
      );
      changelogContext.commits = detailedCommits;
    }
  } catch (error) {
    appLogger.warn({
      analysisId,
      error,
      msg: "Failed to fetch rich git context for CHANGELOG. Falling back to simple list.",
    });
  }
  return runWriterPrompt({
    analysisId,
    name: "changelog",
    phase: "writer_changelog",
    prompt: CHANGELOG_WRITER_USER_PROMPT(
      JSON.stringify(changelogContext, null, 2),
      analysisResult.executive_summary.stack_details
    ),
    system: CHANGELOG_WRITER_SYSTEM_PROMPT(language),
  });
}
