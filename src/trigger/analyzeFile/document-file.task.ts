import { task } from "@trigger.dev/sdk/v3";

import { AI_MODELS } from "@/server/ai/constants";
import { CODE_DOC_SYSTEM_PROMPT, CODE_DOC_USER_PROMPT } from "@/server/ai/prompts";
import { callWithFallback } from "@/server/utils/call";
import { cleanCodeForAi } from "@/server/utils/optimizers";

export const documentFileTask = task({
  id: "document-single-file",
  run: async (payload: { content: string; language: string; path: string; repoId: string }) => {
    const cleanedCode = cleanCodeForAi(payload.content, payload.path);

    const documentedCode = await callWithFallback<string>({
      models: AI_MODELS.WRITER,
      outputSchema: null,
      prompt: CODE_DOC_USER_PROMPT(payload.path, cleanedCode),
      system: CODE_DOC_SYSTEM_PROMPT(payload.language),
      temperature: 0.1,
    });

    return {
      code: documentedCode,
      path: payload.path,
      type: "DOCUMENTATION",
    };
  },
});
