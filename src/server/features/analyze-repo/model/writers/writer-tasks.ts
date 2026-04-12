import type { Repo } from "@prisma/client";

import type { AIResult } from "@/server/shared/engine/core/analysis-result.schemas";
import { prisma } from "@/server/shared/infrastructure/db";
import { getClientContext } from "@/server/shared/infrastructure/github/github-provider";
import { logger } from "@/server/shared/infrastructure/logger";
import { callWithFallback } from "@/server/shared/lib/call";
import { unwrapAiText } from "@/server/shared/lib/optimizers";

import { AI_MODELS, SAFETY_SETTINGS } from "../../lib/constants";
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
} from "../../lib/prompts-refactored";

export type WriterName = "api" | "architecture" | "changelog" | "contributing" | "readme";
export type WriterStatus = "failed" | "fallback" | "llm" | "missing";
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
    logger.warn({ error, msg: "Writer stage failed; continuing with partial docs", writer: name });
    return {
      error: error instanceof Error ? error.message : String(error),
      name,
      status: "failed",
    };
  }
}

async function runWriterPrompt(params: {
  analysisId: string;
  name: WriterResult["name"];
  phase: WriterPhase;
  prompt: string;
  promptChars?: number;
  providerOptions?: { google: { codeExecution: true; safetySettings: typeof SAFETY_SETTINGS } };
  system: string;
  temperature: number;
}) {
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
        ...(params.providerOptions != null ? { providerOptions: params.providerOptions } : {}),
        system: params.system,
        temperature: params.temperature,
      }).then(unwrapAiText)
  );
}

export async function executeReadmeWriter(
  analysisId: string,
  payload: string,
  context: string,
  allowedPaths: string,
  language: string
): Promise<WriterResult> {
  return runWriterPrompt({
    analysisId,
    name: "readme",
    phase: "writer_readme",
    prompt: README_WRITER_USER_PROMPT(payload, context, allowedPaths),
    promptChars: payload.length + context.length,
    providerOptions: { google: { codeExecution: true, safetySettings: SAFETY_SETTINGS } },
    system: README_WRITER_SYSTEM_PROMPT(language),
    temperature: 0.2,
  });
}

export async function executeApiWriter(
  analysisId: string,
  payload: string,
  context: string,
  allowedPaths: string,
  language: string
): Promise<WriterResult> {
  return runWriterPrompt({
    analysisId,
    name: "api",
    phase: "writer_api",
    prompt: API_WRITER_USER_PROMPT(payload, context, allowedPaths),
    promptChars: payload.length + context.length,
    system: API_WRITER_SYSTEM_PROMPT(language),
    temperature: 0.1,
  });
}

export async function executeArchitectureWriter(
  analysisId: string,
  payload: string,
  risksPayload: string,
  onboardingPayload: string,
  context: string,
  allowedPaths: string,
  language: string
): Promise<WriterResult> {
  return runWriterPrompt({
    analysisId,
    name: "architecture",
    phase: "writer_architecture",
    prompt: ARCHITECTURE_WRITER_USER_PROMPT(
      payload,
      risksPayload,
      onboardingPayload,
      context,
      allowedPaths
    ),
    promptChars: payload.length + context.length,
    system: ARCHITECTURE_WRITER_SYSTEM_PROMPT(language),
    temperature: 0.2,
  });
}

export async function executeContributingWriter(
  analysisId: string,
  payload: string,
  context: string,
  allowedPaths: string,
  language: string
): Promise<WriterResult> {
  return runWriterPrompt({
    analysisId,
    name: "contributing",
    phase: "writer_contributing",
    prompt: CONTRIBUTING_WRITER_USER_PROMPT(payload, context, allowedPaths),
    system: CONTRIBUTING_WRITER_SYSTEM_PROMPT(language),
    temperature: 0.2,
  });
}

export async function executeChangelogWriter(
  analysisId: string,
  analysisResult: AIResult,
  userId: number,
  repo: Repo,
  language: string
): Promise<WriterResult> {
  let simpleCommits: Array<{
    author: null | string | undefined;
    date: null | string | undefined;
    message: string;
  }> = [];

  try {
    const { octokit } = await getClientContext(prisma, userId, repo.owner);
    const { data: commitsData } = await octokit.rest.repos.listCommits({
      owner: repo.owner,
      per_page: 50,
      repo: repo.name,
    });

    simpleCommits = commitsData.map((c: (typeof commitsData)[number]) => ({
      author: c.commit.author?.name,
      date: c.commit.author?.date,
      message: c.commit.message,
    }));
  } catch (error) {
    logger.warn({
      analysisId,
      error,
      msg: "Failed to fetch commits for CHANGELOG. Returning empty string.",
    });
  }

  return runWriterPrompt({
    analysisId,
    name: "changelog",
    phase: "writer_changelog",
    prompt: CHANGELOG_WRITER_USER_PROMPT(
      JSON.stringify(simpleCommits, null, 2),
      analysisResult.executive_summary.stack_details
    ),
    system: CHANGELOG_WRITER_SYSTEM_PROMPT(language),
    temperature: 0.2,
  });
}
