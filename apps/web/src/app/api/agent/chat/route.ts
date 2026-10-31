import { headers } from "next/headers";
import { ApiKeyScope, ChatRole } from "@doxynix/shared";
import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  generateText,
  isStepCount,
  streamText,
  toUIMessageStream,
} from "ai";
import { dedent } from "es-toolkit";

import { TOOL_APPROVAL_SECRET } from "@/shared/config/env.server";
import { REALTIME_CONFIG } from "@/shared/config/realtime";

import { getActiveModels } from "@/server/core/ai/ai-constants";
import { google } from "@/server/core/ai/google";
import { AppError } from "@/server/core/api-error";
import { appLogger } from "@/server/core/app-logger";
import { resolveRequestUserId } from "@/server/core/auth/resolve-session";
import { prisma } from "@/server/core/db";
import { getWorkspaceEntitlement } from "@/server/core/entitlements";
import { realtimeService } from "@/server/core/realtime";
import { releaseUsage, reserveUsage, settleUsage } from "@/server/core/usage/usage";
import { resolveWorkspace } from "@/server/core/workspaces/resolve-workspace";
import {
  AGENT_SYSTEM_PROMPT,
  GENERATE_CHAT_TITLE_PROMPT,
} from "@/server/modules/agent/agent.prompts";
import { getAgentTools, MUTATION_TOOLS } from "@/server/modules/agent/agent.tools";
import { processMessageParts } from "@/server/modules/agent/agent-storage";
import { withApiHandler } from "@/server/utils/with-api-handler";

export const maxDuration = 60;

// Reservation for the whole streamed turn; `settleUsage` releases the difference on finish.
const AGENT_TOKEN_ESTIMATE = 2000;

async function handler(req: Request) {
  const { currentRepo, currentRepoId, messages, sessionId } = await req.json();

  const activeModels = await getActiveModels();
  const agentModelId = activeModels.AGENT[0];

  if (agentModelId == null) {
    throw new AppError({
      code: "INTERNAL_SERVER_ERROR",
      publicMessage: "No model configured for AGENT role",
      unexpected: true,
    });
  }

  const requestHeaders = await headers();
  const userId = await resolveRequestUserId(requestHeaders, ApiKeyScope.CLI);

  if (userId == null) {
    throw new AppError({ code: "UNAUTHORIZED", publicMessage: "Sign in to use the agent" });
  }

  const workspace = await resolveWorkspace({
    headerWorkspaceId: requestHeaders.get("x-workspace-id"),
    strict: true,
    userId,
  });

  // The agent spends the same AI budget as analyses: a suspended or exhausted workspace must not
  // reach the model at all. The reservation happens together with this check, just before the
  // model call, so a plain read cannot be raced by a second chat.
  const usageKey = `agent:${sessionId ?? "new"}:${crypto.randomUUID()}`;

  let resolvedRepoId: string | undefined;
  let internalRepoId: null | string = null;

  if (currentRepoId != null) {
    const dbRepo = await prisma.repo.findUnique({
      select: { id: true },
      where: { id: currentRepoId, workspaceId: workspace.id },
    });
    if (dbRepo != null) {
      resolvedRepoId = dbRepo.id;
      internalRepoId = dbRepo.id;
    }
  } else if (currentRepo?.owner != null && currentRepo?.name != null) {
    const dbRepo = await prisma.repo.findFirst({
      select: { id: true },
      where: {
        name: currentRepo.name,
        owner: currentRepo.owner,
        workspaceId: workspace.id,
      },
    });

    if (dbRepo != null) {
      resolvedRepoId = dbRepo.id;
      internalRepoId = dbRepo.id;
    }
  }

  if (sessionId != null) {
    const lastUserMessage = messages.at(-1);

    if (lastUserMessage?.role === "user") {
      const processedParts = await processMessageParts(lastUserMessage.parts);

      await prisma.$transaction(async (tx) => {
        const sessionExists = await tx.chatSession.findUnique({
          select: { id: true },
          where: { id: sessionId, userId },
        });

        if (sessionExists == null) {
          await tx.chatSession.create({
            data: {
              id: sessionId,
              repoId: internalRepoId,
              title: "New Chat",
              userId,
            },
          });
        }

        await tx.chatMessage.create({
          data: {
            parts: JSON.stringify(processedParts),
            role: ChatRole.user,
            sessionId,
          },
        });
      });
    }
  }

  const modelMessages = await convertToModelMessages(messages);
  const isDashboard = resolvedRepoId == null;

  const dynamicSystemPrompt = isDashboard
    ? dedent`${AGENT_SYSTEM_PROMPT}
\n\n[CONTEXT] You are currently helping the user on the GLOBAL DASHBOARD. No repository is selected.
- If they ask to perform actions requiring a repository (such as file audit or analyze), you must first find its UUID. Use 'listRepositories' to search for the repository by its name.
- If the target repository is ambiguous, call 'listRepositories' first to see what projects they have, and ask them to clarify.`
    : dedent`${AGENT_SYSTEM_PROMPT}
\n\n[CONTEXT] Active Repository ID: "${resolvedRepoId}".
- Automatically assume this repository for all tools requiring "repoId" (e.g., quickFileAudit, triggerRepositoryAnalysis, etc.). You do not need to ask the user or search for it.
- Only prompt for a repository ID if the user explicitly wants to target a completely different project.`;

  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`agent-quota:${workspace.id}`}))`;

    const fresh = await getWorkspaceEntitlement(tx, workspace.id, new Date(), { fresh: true });

    if (fresh == null || !fresh.hasAccess) {
      throw new AppError({ code: "PAYMENT_REQUIRED", publicMessage: "PAYMENT_REQUIRED" });
    }

    if (fresh.aiTokensPerMonth != null && fresh.usedTokens >= fresh.aiTokensPerMonth) {
      throw new AppError({ code: "FORBIDDEN", publicMessage: "LIMIT_EXCEEDED" });
    }

    await reserveUsage(tx, {
      estimatedTokens: AGENT_TOKEN_ESTIMATE,
      idempotencyKey: usageKey,
      workspaceId: workspace.id,
    });
  });

  const result = streamText({
    abortSignal: req.signal,
    experimental_toolApprovalSecret: TOOL_APPROVAL_SECRET,
    instructions: dynamicSystemPrompt,
    messages: modelMessages,
    model: google(agentModelId),
    onAbort: () => {
      void releaseUsage(prisma, {
        idempotencyKey: usageKey,
        workspaceId: workspace.id,
      }).catch((error: unknown) => {
        appLogger.error({ error, msg: "agent.usage_release_failed" });
      });
    },
    onEnd: async ({ usage }) => {
      try {
        await settleUsage(prisma, {
          idempotencyKey: usageKey,
          model: agentModelId,
          provider: "google",
          usage: {
            cachedInputTokens: usage.inputTokenDetails.cacheReadTokens ?? 0,
            inputTokens: usage.inputTokens ?? 0,
            outputTokens: usage.outputTokens ?? 0,
          },
          workspaceId: workspace.id,
        });
      } catch (error) {
        // An unpriced model or a DB hiccup must not leave the reservation behind.
        appLogger.error({ error, msg: "agent.usage_settle_failed" });

        await releaseUsage(prisma, {
          idempotencyKey: usageKey,
          workspaceId: workspace.id,
        }).catch((releaseError: unknown) => {
          appLogger.error({ error: releaseError, msg: "agent.usage_release_failed" });
        });
      }
    },
    onError: () => {
      void releaseUsage(prisma, {
        idempotencyKey: usageKey,
        workspaceId: workspace.id,
      }).catch((error: unknown) => {
        appLogger.error({ error, msg: "agent.usage_release_failed" });
      });
    },
    stopWhen: isStepCount(10),
    timeout: { chunkMs: 20_000, stepMs: 55_000, toolMs: 40_000 },
    toolApproval: Object.fromEntries(
      MUTATION_TOOLS.map((name) => [name, "user-approval"] as const),
    ) as Record<(typeof MUTATION_TOOLS)[number], "user-approval">,
    tools: getAgentTools(resolvedRepoId),
  });

  const uiMessageStream = toUIMessageStream({
    onEnd: async ({ messages: callbackMessages, responseMessage }) => {
      if (sessionId != null) {
        await prisma.chatMessage.create({
          data: {
            parts: JSON.stringify(responseMessage.parts),
            role: ChatRole.assistant,
            sessionId,
          },
        });

        try {
          const currentSession = await prisma.chatSession.findUnique({
            select: { title: true },
            where: { id: sessionId, userId },
          });

          if (currentSession?.title === "New Chat") {
            const firstUserMessage = callbackMessages.find((m) => m.role === "user");

            let rawUserText = "";
            if (firstUserMessage?.parts) {
              const firstTextPart = firstUserMessage.parts.find(
                (p: { type: string }) => p.type === "text",
              ) as undefined | { text?: string };
              rawUserText = firstTextPart?.text ?? "";
            }

            if (rawUserText.trim().length > 0) {
              const utilityModelId = activeModels.SENTINEL[0] ?? "gemini-3.5-flash-lite";

              const { text: generatedTitle } = await generateText({
                model: google(utilityModelId),
                prompt: GENERATE_CHAT_TITLE_PROMPT(rawUserText),
                temperature: 0.1,
              });

              const cleanedTitle = generatedTitle.trim().replace(/^["']/, "").replace(/["']$/, "");
              if (cleanedTitle.length > 0) {
                await prisma.chatSession.update({
                  data: { title: cleanedTitle },
                  where: { id: sessionId, userId },
                });

                await realtimeService
                  .user(userId)
                  .publish(REALTIME_CONFIG.events.user.sessionUpdated, {
                    sessionId,
                    title: cleanedTitle,
                  });
              }
            }
          }
        } catch (error) {
          appLogger.error({ error, msg: "Async chat title generation failed in onEnd:" });
        }
      }
    },
    originalMessages: messages,
    stream: result.stream,
  });

  return createUIMessageStreamResponse({ stream: uiMessageStream });
}

// Safe to wrap though it streams: the wrapper only covers setup, and anything thrown after the response is delivered in-stream.
export const POST = withApiHandler(handler, { scope: "agent/chat" });
