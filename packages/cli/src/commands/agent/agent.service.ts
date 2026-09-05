import * as p from "@clack/prompts";

import { getApiUrl, getToken } from "@/core/config";

import { brand, pc } from "@/ui/colors";

import type { PendingToolCall } from "./agent.tools";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export const AgentStreamClient = {
  async stream(
    messages: ChatMessage[],
    repoId?: string,
    sessionId?: string,
  ): Promise<{ fullText: string; pendingTools: PendingToolCall[] }> {
    const token = getToken();
    const apiUrl = getApiUrl();
    const s = p.spinner();

    s.start("AI is processing request...");

    const response = await fetch(`${apiUrl}/agent/chat`, {
      body: JSON.stringify({
        messages: messages.map((m) => ({
          content: m.content,
          id: m.id,
          parts: [{ text: m.content, type: "text" }],
          role: m.role,
        })),
        repoId,
        sessionId,
      }),
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      method: "POST",
    });

    if (!response.ok) {
      s.stop();
      const err = await response.text();
      throw new Error(`Server responded with HTTP ${response.status}: ${err}`);
    }

    if (!response.body) {
      s.stop();
      throw new Error("Empty response stream from server.");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullText = "";
    let buffer = "";
    let isSpinnerRunning = true;
    let hasPrintedHeader = false;

    const toolsMap = new Map<string, PendingToolCall>();

    const stopSpinner = () => {
      if (isSpinnerRunning) {
        s.stop();
        isSpinnerRunning = false;
      }
    };

    const ensureHeader = () => {
      stopSpinner();
      if (!hasPrintedHeader) {
        console.log(`\n${brand.logo("Doxynix AI:")}`);
        hasPrintedHeader = true;
      }
    };

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line.startsWith("data:")) {
          continue;
        }

        const payload = line.replace(/^data:\s*/, "").trim();
        if (payload === "[DONE]") {
          continue;
        }

        try {
          const event: unknown = JSON.parse(payload);
          if (!isRecord(event)) {
            continue;
          }

          if (event.type === "text-delta" && typeof event.delta === "string") {
            ensureHeader();
            process.stdout.write(event.delta);
            fullText += event.delta;
          } else if (event.type === "tool-input-start" || event.type === "tool-call") {
            const toolCallId =
              typeof event.toolCallId === "string" ? event.toolCallId : crypto.randomUUID();
            const toolName = typeof event.toolName === "string" ? event.toolName : "tool";
            toolsMap.set(toolCallId, {
              hasExecutedOnServer: false,
              input: {},
              toolCallId,
              toolName,
            });
            ensureHeader();
            console.log(`\n${pc.yellow("⚡ [Tool Call]:")} ${pc.bold(toolName)}...`);
          } else if (event.type === "tool-input-available") {
            const toolCallId = typeof event.toolCallId === "string" ? event.toolCallId : "";
            const existing = toolsMap.get(toolCallId);
            if (existing) {
              existing.input = isRecord(event.input) ? event.input : {};
            }
            console.log(pc.gray(`   Arguments: ${JSON.stringify(event.input)}`));
          } else if (event.type === "tool-output-available") {
            const toolCallId = typeof event.toolCallId === "string" ? event.toolCallId : "";
            const existing = toolsMap.get(toolCallId);
            if (existing) {
              existing.hasExecutedOnServer = true;
            }
            const out =
              typeof event.output === "string"
                ? event.output
                : event.output !== null && event.output !== undefined
                  ? JSON.stringify(event.output)
                  : "";
            console.log(`${pc.green("✔ [Tool Result]:")} ${pc.gray(out.slice(0, 150))}\n`);
          } else if (event.type === "error") {
            ensureHeader();
            const errStr = typeof event.error === "string" ? event.error : JSON.stringify(event);
            console.log(`\n${brand.error(`❌ Generation error: ${errStr}`)}`);
          }
        } catch {
          if (!payload.startsWith("{")) {
            ensureHeader();
            process.stdout.write(payload);
            fullText += payload;
          }
        }
      }
    }

    stopSpinner();

    return {
      fullText,
      pendingTools: Array.from(toolsMap.values()),
    };
  },
};
