import { ChatRole } from "@prisma/client";
import { convertToModelMessages, generateText, stepCountIs, streamText } from "ai";
import { dedent } from "ts-dedent";

import { REALTIME_CONFIG } from "@/shared/constants/realtime";

import { getServerAuthSession } from "@/server/core/auth";
import { prisma } from "@/server/core/db";
import { google } from "@/server/core/google";
import { realtimeServer } from "@/server/core/realtime";
import { processMessageParts } from "@/server/modules/agent/agent-storage";
import {
  AGENT_SYSTEM_PROMPT,
  GENERATE_CHAT_TITLE_PROMPT,
} from "@/server/modules/agent/agent.prompts";
import { getAgentTools } from "@/server/modules/agent/agent.tools";
import { getActiveModels } from "@/server/modules/analysis/ai/ai-constants";

export const maxDuration = 60;

export async function POST(req: Request) {
  const { currentRepo, currentRepoId, messages, sessionId } = await req.json();

  const activeModels = await getActiveModels();
  const agentModelId = activeModels.AGENT[0];

  if (agentModelId == null) {
    throw new Error("No model configured for AGENT role");
  }

  const session = await getServerAuthSession();

  const userId = session?.user.id != null ? Number(session.user.id) : null;

  let resolvedRepoId: string | undefined;
  let internalRepoId: null | number = null;

  if (currentRepoId != null) {
    resolvedRepoId = currentRepoId;

    const dbRepo = await prisma.repo.findUnique({
      select: { id: true },
      where: { publicId: currentRepoId },
    });
    if (dbRepo != null) {
      internalRepoId = dbRepo.id;
    }
  } else if (currentRepo?.owner != null && currentRepo?.name != null && userId != null) {
    const dbRepo = await prisma.repo.findUnique({
      select: { id: true, publicId: true },
      where: {
        owner_name_userId: {
          name: currentRepo.name,
          owner: currentRepo.owner,
          userId,
        },
      },
    });

    if (dbRepo != null) {
      resolvedRepoId = dbRepo.publicId;
      internalRepoId = dbRepo.id;
    }
  }

  if (sessionId != null) {
    const lastUserMessage = messages.at(-1);

    if (lastUserMessage != null && lastUserMessage.role === "user") {
      const processedParts = await processMessageParts(lastUserMessage.parts);

      await prisma.$transaction(async (tx) => {
        const sessionExists = await tx.chatSession.findUnique({
          where: { id: sessionId },
        });

        if (sessionExists == null && userId != null) {
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

  const result = streamText({
    messages: modelMessages,
    model: google(agentModelId),
    stopWhen: stepCountIs(10),
    system: dynamicSystemPrompt,
    tools: getAgentTools(resolvedRepoId),
  });

  return result.toUIMessageStreamResponse({
    onFinish: async ({ responseMessage }) => {
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
            where: { id: sessionId },
          });

          if (currentSession != null && currentSession.title === "New Chat") {
            const firstUserMessage = messages.find((m: any) => m.role === "user");
            const firstTextPart = firstUserMessage?.parts?.find(
              (p: any) => p.type === "text"
            ) as any;
            const rawUserText = firstTextPart?.text ?? "";

            if (rawUserText.trim().length > 0) {
              const utilityModelId = activeModels.SENTINEL[0] ?? "gemini-3.1-flash-lite";

              const { text: generatedTitle } = await generateText({
                model: google(utilityModelId),
                prompt: GENERATE_CHAT_TITLE_PROMPT(rawUserText),
                temperature: 0.1,
              });

              const cleanedTitle = generatedTitle.trim().replaceAll(/^["']|["']$/g, "");
              if (cleanedTitle.length > 0) {
                await prisma.chatSession.update({
                  data: { title: cleanedTitle },
                  where: { id: sessionId },
                });

                const channelName = REALTIME_CONFIG.channels.user(String(userId));
                await realtimeServer.channels
                  .get(channelName)
                  .publish(REALTIME_CONFIG.events.user.sessionUpdated, {
                    sessionId,
                    title: cleanedTitle,
                  });
              }
            }
          }
        } catch (error) {
          console.error("Async chat title generation failed in onFinish:", error);
        }
      }
    },
    originalMessages: messages,
  });
}
