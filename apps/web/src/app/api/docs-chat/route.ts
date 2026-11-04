import { MessageCode } from "@doxynix/shared";
import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  isStepCount,
  streamText,
  toUIMessageStream,
  type UIMessage,
} from "ai";

import { docsSource } from "@/shared/lib/docs-source";

import { getActiveModels } from "@/server/core/ai/ai-constants";
import { buildDocsChatSystemPrompt } from "@/server/core/ai/docs-chat.prompt";
import { docsChatTools } from "@/server/core/ai/docs-chat.tool";
import { google } from "@/server/core/ai/google";
import { AppError } from "@/server/core/api-error";
import { appLogger } from "@/server/core/app-logger";
import { docsChatGlobalLimiter, docsChatLimiter } from "@/server/core/ratelimit";
import { getIp } from "@/server/utils/request-context";
import { withApiHandler } from "@/server/utils/with-api-handler";

export const maxDuration = 45;

const MAX_MESSAGES = 20;
const MAX_QUESTION_LENGTH = 2000;

type IncomingPart = {
  text?: string;
  type?: string;
};

type IncomingMessage = {
  parts?: IncomingPart[];
  role?: string;
};

function readQuestion(messages: IncomingMessage[]): string {
  const lastUserMessage = [...messages].reverse().find((message) => message.role === "user");

  return (
    lastUserMessage?.parts
      ?.filter((part) => part.type === "text")
      .map((part) => part.text ?? "")
      .join("") ?? ""
  );
}

async function handler(req: Request) {
  let body: { messages?: IncomingMessage[] };

  try {
    body = (await req.json()) as { messages?: IncomingMessage[] };
  } catch {
    throw new AppError({
      code: "BAD_REQUEST",
      messageCode: MessageCode.REQUEST_BODY_INVALID,
      publicMessage: "Invalid JSON body",
    });
  }

  const messages = body.messages;

  if (!Array.isArray(messages) || messages.length === 0 || messages.length > MAX_MESSAGES) {
    throw new AppError({
      code: "BAD_REQUEST",
      messageCode: MessageCode.REQUEST_INVALID,
      publicMessage: "Invalid messages",
    });
  }

  const question = readQuestion(messages);

  if (question.trim().length === 0 || question.length > MAX_QUESTION_LENGTH) {
    throw new AppError({
      code: "BAD_REQUEST",
      messageCode: MessageCode.REQUEST_INVALID,
      publicMessage: "Invalid question",
    });
  }

  const ip = getIp(req);

  try {
    const [perIp, global] = await Promise.all([
      docsChatLimiter.limit(`ip:${ip}`),
      docsChatGlobalLimiter.limit("global"),
    ]);

    if (!perIp.success || !global.success) {
      throw new AppError({
        code: "TOO_MANY_REQUESTS",
        messageCode: MessageCode.AGENT_TOO_MANY_QUESTIONS,
        publicMessage: "Too many questions. Please try again later.",
      });
    }
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }

    appLogger.error({ error, msg: "docs_chat.rate_limit_failed" });

    throw new AppError({
      code: "INTERNAL_SERVER_ERROR",
      messageCode: MessageCode.AGENT_UNAVAILABLE,
      publicMessage: "The assistant is temporarily unavailable.",
      unexpected: true,
    });
  }

  const activeModels = await getActiveModels();
  const modelId = activeModels.AGENT[0];

  if (modelId == null) {
    throw new AppError({
      code: "INTERNAL_SERVER_ERROR",
      messageCode: MessageCode.AGENT_UNAVAILABLE,
      publicMessage: "The assistant is temporarily unavailable.",
      unexpected: true,
    });
  }

  const pages = docsSource.getPages().map((page) => ({
    description: page.data.description,
    title: page.data.title,
    url: page.url,
  }));

  const result = streamText({
    abortSignal: req.signal,
    instructions: buildDocsChatSystemPrompt(pages),
    maxOutputTokens: 900,
    messages: await convertToModelMessages(messages as UIMessage[]),
    model: google(modelId),
    onError: ({ error }) => {
      appLogger.error({ error, msg: "docs_chat.stream_failed" });
    },
    stopWhen: isStepCount(4),
    temperature: 0.2,
    timeout: { chunkMs: 15_000, stepMs: 30_000, toolMs: 10_000 },
    tools: docsChatTools,
  });

  const uiMessageStream = toUIMessageStream({
    onError: (error) => {
      appLogger.error({ error, msg: "docs_chat.stream_error" });

      return "The assistant is temporarily unavailable. Please try again later.";
    },
    stream: result.stream,
  });

  return createUIMessageStreamResponse({ stream: uiMessageStream });
}

export const POST = withApiHandler(handler, { scope: "docs/chat" });
