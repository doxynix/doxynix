import { task } from "@trigger.dev/sdk/v3";

import { AI_MODELS } from "@/server/ai/constants";
import { callWithFallback } from "@/server/utils/call";
import { cleanCodeForAi } from "@/server/utils/optimizers";

export const analyzeFileTask = task({
  id: "analyze-single-file",
  run: async (payload: { content: string; language: string; path: string }) => {
    const cleanedCode = cleanCodeForAi(payload.content, payload.path);

    const feedback = await callWithFallback<string>({
      models: AI_MODELS.POWERFUL,
      outputSchema: null,
      prompt: `Файл: ${payload.path}\n\nКод:\n${cleanedCode}`,
      system: `Ты — Senior Code Reviewer. Проанализируй файл и дай краткие советы по улучшению, безопасности и чистоте кода на языке ${payload.language}. Используй Markdown.`,
      temperature: 0.2,
    });

    return {
      feedback: feedback,
      path: payload.path,
      type: "AUDIT",
    };
  },
});
