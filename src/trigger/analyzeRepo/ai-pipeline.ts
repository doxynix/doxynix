import { DocType, type Repo, type Status } from "@prisma/client";

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
import { prisma } from "@/server/db/db";
import { logger } from "@/server/logger/logger";
import { githubService } from "@/server/services/github.service";
import { callWithFallback } from "@/server/utils/call";
import { FileClassifier } from "@/server/utils/file-classifier";
import { cleanCodeForAi, unwrapAiText } from "@/server/utils/optimizers";

type StatusUpdater = (msg: string, percent: number, status?: Status) => Promise<void>;

export async function runAiPipeline(
  validFiles: { content: string; path: string }[],
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
        attemptMetadata: { analysisId, phase: "sentinel" },
        models: AI_MODELS.SENTINEL,
        outputSchema: sentinelSchema,
        prompt: SENTINEL_USER_PROMPT(instructions!),
        providerOptions: { google: { codeExecution: true, safetySettings: SAFETY_SETTINGS } },
        system: SENTINEL_SYSTEM_PROMPT,
        temperature: 0.0,
      });
      sentinelStatus = sentinelOut.status;
    } catch (e) {
      logger.warn({ analysisId, error: e, msg: "Sentinel unavailable, defaulting to SAFE" });
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
    attemptMetadata: { analysisId, phase: "mapper" },
    models: AI_MODELS.CARTOGRAPHER,
    outputSchema: projectMapSchema,
    prompt: MAPPER_USER_PROMPT(mapContext),
    providerOptions: { google: { codeExecution: true, safetySettings: SAFETY_SETTINGS } },
    system: MAPPER_SYSTEM_PROMPT,
    temperature: 0.05,
  });

  logger.debug({
    analysisId,
    msg: "Project map generated",
    projectMapSummary: Object.keys(projectMap.modules).length,
  });

  console.log(JSON.stringify(projectMap, null, 2));

  await updateStatus("Deep Analysis & Swagger Gen (Step 2/3)...", 70);

  const SMART_CONTEXT_LIMIT = 1500000;

  const architectContext = prepareSmartContext(validFiles, SMART_CONTEXT_LIMIT);

  return await callWithFallback<AIResult>({
    attemptMetadata: { analysisId, phase: "architect" },
    models: [...AI_MODELS.POWERFUL, ...AI_MODELS.ARCHITECT, ...AI_MODELS.FALLBACK],
    outputSchema: aiSchema,
    prompt: ANALYSIS_USER_PROMPT(
      architectContext,
      JSON.stringify(projectMap),
      instructions ?? "Focus on critical business logic and security.",
      sentinelStatus
    ),
    providerOptions: { google: { codeExecution: true, safetySettings: SAFETY_SETTINGS } },
    system: ANALYSIS_SYSTEM_PROMPT(language),
    temperature: 0.1,
  });
}

export async function generateDeepDocs(
  files: { content: string; path: string }[],
  analysisResult: AIResult,
  analysisId: string,
  requestedDocs: DocType[],
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
  if (requestedDocs.includes(DocType.README)) {
    taskMap["README"] = tasks.length;
    tasks.push(
      callWithFallback<string>({
        attemptMetadata: { analysisId, phase: "writer_readme" },
        models: AI_MODELS.WRITER,
        outputSchema: null,
        prompt: README_WRITER_USER_PROMPT(
          analysisResult.executive_summary.purpose,
          analysisResult.executive_summary.stack_details,
          configContext
        ),
        providerOptions: { google: { codeExecution: true, safetySettings: SAFETY_SETTINGS } },
        system: README_WRITER_SYSTEM_PROMPT(language),
        temperature: 0.2,
      }).then(unwrapAiText)
    );
  }

  // 2. API DOCS
  if (requestedDocs.includes(DocType.API)) {
    taskMap["API"] = tasks.length;
    tasks.push(
      callWithFallback<string>({
        attemptMetadata: { analysisId, phase: "writer_api" },
        models: AI_MODELS.WRITER,
        outputSchema: null,
        prompt: API_WRITER_USER_PROMPT(apiContext),
        system: API_WRITER_SYSTEM_PROMPT(language),
        temperature: 0.1,
      }).then(unwrapAiText)
    );
  }

  // 3. CONTRIBUTING
  if (requestedDocs.includes(DocType.CONTRIBUTING)) {
    taskMap["CONTRIBUTING"] = tasks.length;
    tasks.push(
      callWithFallback<string>({
        attemptMetadata: { analysisId, phase: "writer_contributing" },
        models: AI_MODELS.WRITER,
        outputSchema: null,
        prompt: CONTRIBUTING_WRITER_USER_PROMPT(
          analysisResult.executive_summary.stack_details,
          configContext
        ),
        system: CONTRIBUTING_WRITER_SYSTEM_PROMPT(language),
        temperature: 0.2,
      }).then(unwrapAiText)
    );
  }

  // 4. CHANGELOG
  if (requestedDocs.includes(DocType.CHANGELOG)) {
    taskMap["CHANGELOG"] = tasks.length;
    tasks.push(
      (async () => {
        const octokit = await githubService.getClientForUser(prisma, userId);
        const { data: commitsData } = await octokit.repos.listCommits({
          owner: repo.owner,
          per_page: 50, // NOTE: тут возможно стоит придумать другую логику
          repo: repo.name,
        });

        const simpleCommits = commitsData.map((c) => ({
          author: c.commit.author?.name,
          date: c.commit.author?.date,
          message: c.commit.message,
        }));

        return callWithFallback<string>({
          attemptMetadata: { analysisId, phase: "writer_changelog" },
          models: AI_MODELS.WRITER,
          outputSchema: null,
          prompt: CHANGELOG_WRITER_USER_PROMPT(
            JSON.stringify(simpleCommits, null, 2),
            analysisResult.executive_summary.stack_details
          ),
          system: CHANGELOG_WRITER_SYSTEM_PROMPT(language),
          temperature: 0.2,
        }).then(unwrapAiText);
      })()
    );
  }

  // 5. ARCHITECTURE
  if (requestedDocs.includes(DocType.ARCHITECTURE)) {
    taskMap["ARCHITECTURE"] = tasks.length;
    tasks.push(
      callWithFallback<string>({
        attemptMetadata: { analysisId, phase: "writer_architecture" },
        models: AI_MODELS.WRITER,
        outputSchema: null,
        prompt: ARCHITECTURE_WRITER_USER_PROMPT(
          JSON.stringify(analysisResult.sections),
          JSON.stringify(analysisResult.executive_summary)
        ),
        system: ARCHITECTURE_WRITER_SYSTEM_PROMPT(language),
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

  readme = results[taskMap["README"]];

  const apiOutput = results[taskMap["API"]];
  const yamlMatch = RegExp(/```yaml([\s\S]*?)```/).exec(apiOutput);
  if (yamlMatch) {
    swaggerYaml = yamlMatch[1].trim();
    apiDoc = apiOutput.replace(/# OpenAPI Specification[\s\S]*/, "").trim();
  } else {
    apiDoc = apiOutput;
  }

  contributing = results[taskMap["CONTRIBUTING"]];

  changelog = results[taskMap["CHANGELOG"]];

  architecture = results[taskMap["ARCHITECTURE"]];

  return { apiDoc, architecture, changelog, contributing, readme, swaggerYaml };
}
