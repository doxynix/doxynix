import { prisma } from "@/shared/api/db/db";
import { logger } from "@/shared/lib/logger";

import type { Repo } from "@/generated/zod";
import DocTypeSchema, { type DocTypeType } from "@/generated/zod/inputTypeSchemas/DocTypeSchema";
import type { StatusType } from "@/generated/zod/inputTypeSchemas/StatusSchema";
import { AI_MODELS, SAFETY_SETTINGS } from "@/server/ai/constants";
import { prepareSmartContext } from "@/server/ai/context-manager";
import {
  ANALYSIS_SYSTEM_PROMPT,
  ANALYSIS_USER_PROMPT,
  API_WRITER_SYSTEM_PROMPT,
  API_WRITER_USER_PROMPT,
  ARCHITECTURE_WRITER_SYSTEM_PROMPT,
  ARCHITECTURE_WRITER_USER_PROMPT,
  CHANGELOG_WRITER_SYSTEM_PROMPT,
  CHANGELOG_WRITER_USER_PROMPT,
  CONTRIBUTING_WRITER_SYSTEM_PROMPT,
  CONTRIBUTING_WRITER_USER_PROMPT,
  MAPPER_SYSTEM_PROMPT,
  MAPPER_USER_PROMPT,
  README_WRITER_SYSTEM_PROMPT,
  README_WRITER_USER_PROMPT,
  SENTINEL_SYSTEM_PROMPT,
  SENTINEL_USER_PROMPT,
} from "@/server/ai/prompts";
import {
  aiSchema,
  projectMapSchema,
  sentinelSchema,
  type AIResult,
  type ProjectMap,
  type SentinelResult,
} from "@/server/ai/schemas";
import { githubService } from "@/server/services/github.service";
import { callWithFallback } from "@/server/utils/call";
import { FileClassifier } from "@/server/utils/file-classifier";
import { cleanCodeForAi, unwrapAiText } from "@/server/utils/optimizers";

type StatusUpdater = (msg: string, percent: number, status?: StatusType) => Promise<void>;

export async function runAiPipeline(
  validFiles: { path: string; content: string }[],
  instructions: string | undefined,
  updateStatus: StatusUpdater,
  analysisId: string,
  language: string
): Promise<AIResult> {
  await updateStatus("Scanning input for threats...", 40);
  let sentinelStatus: "SAFE" | "UNSAFE" = "SAFE";

  if (instructions != null && instructions.length > 5) {
    try {
      const sentinelOut = await callWithFallback<SentinelResult>({
        models: AI_MODELS.SENTINEL,
        system: SENTINEL_SYSTEM_PROMPT,
        prompt: SENTINEL_USER_PROMPT(instructions!),
        outputSchema: sentinelSchema,
        providerOptions: { google: { safetySettings: SAFETY_SETTINGS, codeExecution: true } },
        temperature: 0.0,
        attemptMetadata: { phase: "sentinel", analysisId },
      });
      sentinelStatus = sentinelOut.status;
    } catch (e) {
      logger.warn({ msg: "Sentinel unavailable, defaulting to SAFE", analysisId, error: e });
      sentinelStatus = "SAFE";
    }
  }
  await updateStatus("Mapping project structure (Step 1/3)...", 45);
  const MAX_FLASH_CHARS = 200000;
  const mapContext = validFiles
    .map(
      (f) => `<file path="${f.path}">\n${cleanCodeForAi(f.content, f.path).slice(0, 500)}\n</file>`
    )
    .join("\n")
    .slice(0, MAX_FLASH_CHARS);

  const projectMap = await callWithFallback<ProjectMap>({
    models: AI_MODELS.CARTOGRAPHER,
    system: MAPPER_SYSTEM_PROMPT,
    prompt: MAPPER_USER_PROMPT(mapContext),
    outputSchema: projectMapSchema,
    providerOptions: { google: { safetySettings: SAFETY_SETTINGS, codeExecution: true } },
    temperature: 0.05,
    attemptMetadata: { phase: "mapper", analysisId },
  });

  logger.debug({
    msg: "Project map generated",
    analysisId,
    projectMapSummary: Object.keys(projectMap.modules ?? {}).length ?? null,
  });

  console.log(JSON.stringify(projectMap, null, 2));

  await updateStatus("Deep Analysis & Swagger Gen (Step 2/3)...", 70);

  const SMART_CONTEXT_LIMIT = 1500000;

  const architectContext = prepareSmartContext(validFiles, SMART_CONTEXT_LIMIT);

  const aiResult = await callWithFallback<AIResult>({
    models: [...AI_MODELS.POWERFUL, ...AI_MODELS.ARCHITECT, ...AI_MODELS.FALLBACK],
    system: ANALYSIS_SYSTEM_PROMPT(language),
    prompt: ANALYSIS_USER_PROMPT(
      architectContext,
      JSON.stringify(projectMap),
      instructions ?? "Focus on critical business logic and security.",
      sentinelStatus
    ),
    outputSchema: aiSchema,
    providerOptions: { google: { safetySettings: SAFETY_SETTINGS, codeExecution: true } },
    temperature: 0.1,
    attemptMetadata: { phase: "architect", analysisId },
  });

  if (aiResult == null) throw new Error("AI model failed.");
  return aiResult;
}

export async function generateDeepDocs(
  files: { path: string; content: string }[],
  analysisResult: AIResult,
  analysisId: string,
  requestedDocs: DocTypeType[],
  repo: Repo,
  userId: number,
  language: string
) {
  const apiFiles = files.filter((f) => FileClassifier.isApiFile(f.path));
  const configFiles = files.filter((f) => FileClassifier.isConfigFile(f.path));

  const apiContext = apiFiles
    .map((f) => `// File: ${f.path}\n${cleanCodeForAi(f.content)}`)
    .join("\n\n");

  const configContext = configFiles
    .map((f) => `// File: ${f.path}\n${cleanCodeForAi(f.content)}`)
    .join("\n\n");

  const tasks: Promise<string>[] = [];
  const taskMap: Record<string, number> = {};

  // 1. README
  if (requestedDocs.includes(DocTypeSchema.enum.README)) {
    taskMap["README"] = tasks.length;
    tasks.push(
      callWithFallback<string>({
        models: AI_MODELS.WRITER,
        system: README_WRITER_SYSTEM_PROMPT(language),
        prompt: README_WRITER_USER_PROMPT(
          analysisResult.executive_summary.purpose,
          analysisResult.executive_summary.stack_details,
          configContext
        ),
        providerOptions: { google: { safetySettings: SAFETY_SETTINGS, codeExecution: true } },
        outputSchema: null,
        attemptMetadata: { phase: "writer_readme", analysisId },
        temperature: 0.2,
      }).then(unwrapAiText)
    );
  }

  // 2. API DOCS
  if (requestedDocs.includes(DocTypeSchema.enum.API)) {
    taskMap["API"] = tasks.length;
    tasks.push(
      callWithFallback<string>({
        models: AI_MODELS.WRITER,
        system: API_WRITER_SYSTEM_PROMPT(language),
        prompt: API_WRITER_USER_PROMPT(apiContext),
        outputSchema: null,
        attemptMetadata: { phase: "writer_api", analysisId },
        temperature: 0.1,
      }).then(unwrapAiText)
    );
  }

  // 3. CONTRIBUTING
  if (requestedDocs.includes(DocTypeSchema.enum.CONTRIBUTING)) {
    taskMap["CONTRIBUTING"] = tasks.length;
    tasks.push(
      callWithFallback<string>({
        models: AI_MODELS.WRITER,
        system: CONTRIBUTING_WRITER_SYSTEM_PROMPT(language),
        prompt: CONTRIBUTING_WRITER_USER_PROMPT(
          analysisResult.executive_summary.stack_details,
          configContext
        ),
        outputSchema: null,
        attemptMetadata: { phase: "writer_contributing", analysisId },
        temperature: 0.2,
      }).then(unwrapAiText)
    );
  }

  // 4. CHANGELOG
  if (requestedDocs.includes(DocTypeSchema.enum.CHANGELOG)) {
    taskMap["CHANGELOG"] = tasks.length;
    tasks.push(
      (async () => {
        const octokit = await githubService.getClientForUser(prisma, userId);
        const { data: commitsData } = await octokit.repos.listCommits({
          owner: repo.owner,
          repo: repo.name,
          per_page: 50, // NOTE: тут возможно стоит придумать другую логику
        });

        const simpleCommits = commitsData.map((c) => ({
          message: c.commit.message,
          author: c.commit.author?.name,
          date: c.commit.author?.date,
        }));

        return callWithFallback<string>({
          models: AI_MODELS.WRITER,
          system: CHANGELOG_WRITER_SYSTEM_PROMPT(language),
          prompt: CHANGELOG_WRITER_USER_PROMPT(
            JSON.stringify(simpleCommits, null, 2),
            analysisResult.executive_summary.stack_details
          ),
          outputSchema: null,
          attemptMetadata: { phase: "writer_changelog", analysisId },
          temperature: 0.2,
        }).then(unwrapAiText);
      })()
    );
  }

  // 5. ARCHITECTURE
  if (requestedDocs.includes(DocTypeSchema.enum.ARCHITECTURE)) {
    taskMap["ARCHITECTURE"] = tasks.length;
    tasks.push(
      callWithFallback<string>({
        models: AI_MODELS.WRITER,
        system: ARCHITECTURE_WRITER_SYSTEM_PROMPT(language),
        prompt: ARCHITECTURE_WRITER_USER_PROMPT(
          JSON.stringify(analysisResult.sections),
          JSON.stringify(analysisResult.executive_summary)
        ),
        outputSchema: null,
        attemptMetadata: { phase: "writer_architecture", analysisId },
        temperature: 0.2,
      }).then(unwrapAiText)
    );
  }

  const results = await Promise.all(tasks);

  let readme = undefined;
  let apiDoc = undefined;
  let swaggerYaml = undefined;
  let contributing = undefined;
  let changelog = undefined;
  let architecture = undefined;

  if (taskMap["README"] != null) {
    readme = results[taskMap["README"]];
  }

  if (taskMap["API"] != null) {
    const apiOutput = results[taskMap["API"]];
    const yamlMatch = apiOutput.match(/```yaml([\s\S]*?)```/);
    if (yamlMatch) {
      swaggerYaml = yamlMatch[1].trim();
      apiDoc = apiOutput.replace(/# OpenAPI Specification[\s\S]*/, "").trim();
    } else {
      apiDoc = apiOutput;
    }
  }

  if (taskMap["CONTRIBUTING"] != null) {
    contributing = results[taskMap["CONTRIBUTING"]];
  }

  if (taskMap["CHANGELOG"] != null) {
    changelog = results[taskMap["CHANGELOG"]];
  }

  if (taskMap["ARCHITECTURE"] != null) {
    architecture = results[taskMap["ARCHITECTURE"]];
  }

  return { readme, apiDoc, swaggerYaml, contributing, changelog, architecture };
}
