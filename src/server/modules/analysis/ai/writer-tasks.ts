import { type GoogleLanguageModelOptions } from "@ai-sdk/google";
import type { Repo } from "@prisma/client";
import type { ToolSet } from "ai";

import { appLogger } from "@/server/core/app-logger";
import { prisma } from "@/server/core/db";
import { getClientContext } from "@/server/core/github/github-provider";
import { google } from "@/server/core/google";
import { callWithFallback } from "@/server/utils/call";
import { unwrapAiText } from "@/server/utils/optimizers";

import type { AIResult } from "../engine/core/analysis-result.schemas";
import { getActiveModels, SAFETY_SETTINGS } from "./ai-constants";
import { buildRepositoryTools } from "./ai-tools";
import {
  buildApiWriterSystemPrompt,
  buildApiWriterUserPrompt,
  buildArchitectureWriterSystemPrompt,
  buildArchitectureWriterUserPrompt,
  buildChangelogWriterSystemPrompt,
  buildChangelogWriterUserPrompt,
  buildContributingWriterSystemPrompt,
  buildContributingWriterUserPrompt,
  buildReadmeWriterSystemPrompt,
  buildReadmeWriterUserPrompt,
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

  const activeModels = await getActiveModels();

  return runWriterTask(params.name, async () =>
    callWithFallback<string>({
      attemptMetadata: {
        analysisId: params.analysisId,
        phase: params.phase,
        ...(params.promptChars != null ? { promptChars: params.promptChars } : {}),
      },
      models: activeModels.WRITER,
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
    prompt: buildReadmeWriterUserPrompt(payload, engineeringDossierPayload, context, allowedPaths),
    promptChars: payload.length + engineeringDossierPayload.length + context.length,
    system: buildReadmeWriterSystemPrompt(language),
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
    prompt: buildApiWriterUserPrompt(payload, engineeringDossierPayload, context, allowedPaths),
    promptChars: payload.length + engineeringDossierPayload.length + context.length,
    system: buildApiWriterSystemPrompt(language),
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
    prompt: buildArchitectureWriterUserPrompt(
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
    system: buildArchitectureWriterSystemPrompt(language),
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
    prompt: buildContributingWriterUserPrompt(
      payload,
      engineeringDossierPayload,
      context,
      allowedPaths
    ),
    promptChars: payload.length + engineeringDossierPayload.length + context.length,
    system: buildContributingWriterSystemPrompt(language),
    tools: buildRepositoryTools(userId, repoId, branch),
  });
}

type ChangelogCommit = {
  author: null | string | undefined;
  message: string;
};

type ChangelogPullRequest = {
  author: null | string | undefined;
  labels: string[];
  number: number;
  title: string;
};

type ChangelogContext = {
  analysisDelta: {
    complexity_score: null | number | undefined;
    diff_summary?: {
      files_changed: number;
      top_modified_files: string[];
    };
    new_findings: Array<{ file: string; title: string; type: string }>;
    security_score: null | number | undefined;
  };
  commits: ChangelogCommit[];
  pullRequests: ChangelogPullRequest[];
};

export async function executeChangelogWriter(
  analysisId: string,
  analysisResult: AIResult,
  userId: number,
  repo: Repo,
  language: string
): Promise<WriterResult> {
  const changelogContext: ChangelogContext = {
    analysisDelta: {
      complexity_score: analysisResult.complexityScore ?? null,
      new_findings:
        analysisResult.findings?.slice(0, 10).map((f) => ({
          file: typeof f.file === "string" ? f.file : "",
          title: f.title,
          type: typeof f.type === "string" ? f.type : "",
        })) ?? [],
      security_score: analysisResult.securityScore ?? null,
    },
    commits: [],
    pullRequests: [],
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

      changelogContext.commits = compareData.commits.slice(0, 20).map((c) => ({
        author: c.commit.author?.name,
        message: c.commit.message,
      }));

      changelogContext.analysisDelta.diff_summary = {
        files_changed: compareData.files?.length ?? 0,
        top_modified_files:
          compareData.files != null
            ? compareData.files
                .toSorted((left, right) => right.changes - left.changes)
                .slice(0, 15)
                .map((f) => f.filename)
            : [],
      };

      const previousDate = previousAnalysis.createdAt.toISOString();
      const q = `repo:${repo.owner}/${repo.name} is:pr is:merged merged:>=${previousDate}`;

      const { data: searchResult } = await octokit.rest.search.issuesAndPullRequests({
        per_page: 15,
        q,
      });

      changelogContext.pullRequests = searchResult.items.map((pr) => ({
        author: pr.user?.login,
        labels: pr.labels
          .map((l) => (typeof l === "string" ? l : (l.name ?? "")))
          .filter((name) => name.length > 0),
        number: pr.number,
        title: pr.title,
      }));
    } else {
      const { data: pulls } = await octokit.rest.pulls.list({
        direction: "desc",
        owner: repo.owner,
        per_page: 10,
        repo: repo.name,
        sort: "updated",
        state: "closed",
      });

      changelogContext.pullRequests = pulls
        .filter((pr) => pr.merged_at != null)
        .map((pr) => ({
          author: pr.user?.login,
          labels: pr.labels
            .map((l) => (typeof l === "string" ? l : l.name))
            .filter((name) => name.length > 0),
          number: pr.number,
          title: pr.title,
        }));

      const { data: commitsData } = await octokit.rest.repos.listCommits({
        owner: repo.owner,
        per_page: 15,
        repo: repo.name,
      });

      changelogContext.commits = commitsData.map((c) => ({
        author: c.commit.author?.name,
        message: c.commit.message,
      }));
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
    prompt: buildChangelogWriterUserPrompt({
      analysisDeltaJson: JSON.stringify(changelogContext.analysisDelta, null, 2),
      commitsJson: JSON.stringify(changelogContext.commits, null, 2),
      pullRequestsJson: JSON.stringify(changelogContext.pullRequests, null, 2),
      techStack: analysisResult.executive_summary.stack_details,
    }),
    system: buildChangelogWriterSystemPrompt(language),
  });
}
