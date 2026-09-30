import type { GoogleLanguageModelOptions } from "@ai-sdk/google";
import type { Repo } from "@prisma/client";
import type { ToolSet } from "ai";

import { getActiveModels, SAFETY_SETTINGS } from "@/server/core/ai/ai-constants";
import { buildRepositoryToolProfile } from "@/server/core/ai/ai-tools";
import { appLogger } from "@/server/core/app-logger";
import { prisma } from "@/server/core/db";
import { getClientContext } from "@/server/core/github/github-provider";
import { callWithFallback } from "@/server/utils/call";
import { unwrapAiText } from "@/server/utils/optimizers";

import type { AIResult } from "../engine/core/analysis-result.schemas";
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
  runner: () => Promise<string>,
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
      stream: false,
      system: params.system,
      ...(params.providerOptions != null ? { providerOptions: params.providerOptions } : {}),
      providerOptions: params.providerOptions ?? defaultProviderOptions,
      taskType: "creative",
      temperature: params.temperature,
      tools: params.tools,
    }).then(unwrapAiText),
  );
}

type SimpleWriterArgs = [
  analysisId: string,
  payload: string,
  engineeringDossierPayload: string,
  context: string,
  allowedPaths: string,
  language: string,
  repoId: string,
  userId: string,
  branch: string,
];

const SIMPLE_WRITERS = {
  api: {
    buildSystemPrompt: buildApiWriterSystemPrompt,
    buildUserPrompt: buildApiWriterUserPrompt,
    phase: "writer_api",
  },
  contributing: {
    buildSystemPrompt: buildContributingWriterSystemPrompt,
    buildUserPrompt: buildContributingWriterUserPrompt,
    phase: "writer_contributing",
  },
  readme: {
    buildSystemPrompt: buildReadmeWriterSystemPrompt,
    buildUserPrompt: buildReadmeWriterUserPrompt,
    phase: "writer_readme",
  },
} as const;

type SimpleWriterName = keyof typeof SIMPLE_WRITERS;

function runSimpleWriter(name: SimpleWriterName, args: SimpleWriterArgs): Promise<WriterResult> {
  const [
    analysisId,
    payload,
    engineeringDossierPayload,
    context,
    allowedPaths,
    language,
    repoId,
    userId,
    branch,
  ] = args;
  const { buildSystemPrompt, buildUserPrompt, phase } = SIMPLE_WRITERS[name];

  return runWriterPrompt({
    analysisId,
    name,
    phase,
    prompt: buildUserPrompt(payload, engineeringDossierPayload, context, allowedPaths),
    promptChars: payload.length + engineeringDossierPayload.length + context.length,
    system: buildSystemPrompt(language),
    tools: buildRepositoryToolProfile(phase, userId, repoId, branch),
  });
}

export async function executeReadmeWriter(...args: SimpleWriterArgs): Promise<WriterResult> {
  return runSimpleWriter("readme", args);
}

export async function executeApiWriter(...args: SimpleWriterArgs): Promise<WriterResult> {
  return runSimpleWriter("api", args);
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
  userId: string,
  branch: string,
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
      allowedPaths,
    ),
    promptChars:
      payload.length +
      moduleDependencyContextPayload.length +
      engineeringDossierPayload.length +
      context.length,
    system: buildArchitectureWriterSystemPrompt(language),
    tools: buildRepositoryToolProfile("writer_architecture", userId, repoId, branch),
  });
}

export async function executeContributingWriter(...args: SimpleWriterArgs): Promise<WriterResult> {
  return runSimpleWriter("contributing", args);
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

function firstCommitLine(message: string) {
  return message.split(/\r?\n/u)[0]?.trim() ?? "";
}

function formatChangelogCommits(commits: ChangelogCommit[]) {
  if (commits.length === 0) {
    return "No commits available.";
  }

  return commits
    .map((commit) => {
      const author = commit.author?.trim() ?? "unknown";
      const message = firstCommitLine(commit.message);
      return `- ${author}: ${message}`;
    })
    .join("\n");
}

function formatChangelogPullRequests(pullRequests: ChangelogPullRequest[]) {
  if (pullRequests.length === 0) {
    return "No merged pull requests available.";
  }

  return pullRequests
    .map((pr) => {
      const labels = pr.labels.length > 0 ? ` [${pr.labels.join(", ")}]` : "";
      const author = pr.author?.trim() ?? "unknown";
      return `- PR-${pr.number}${labels} by ${author}: ${pr.title}`;
    })
    .join("\n");
}

export async function executeChangelogWriter(
  analysisId: string,
  analysisResult: AIResult,
  userId: string,
  repo: Repo,
  language: string,
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
        id: { not: analysisId },
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
      analysisDeltaJson: JSON.stringify(changelogContext.analysisDelta),
      commitsJson: formatChangelogCommits(changelogContext.commits),
      pullRequestsJson: formatChangelogPullRequests(changelogContext.pullRequests),
    }),
    system: buildChangelogWriterSystemPrompt(language),
  });
}
