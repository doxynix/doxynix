import * as p from "@clack/prompts";

import { trpc } from "@/core/client";
import { getApiUrl, getToken } from "@/core/config";

import { brand, pc } from "@/ui/colors";
import { icons } from "@/ui/icons";
import { renderMarkdownLine, resetMarkdownState } from "@/ui/markdown";

import type {
  CreateSessionInput,
  ListSessionsInput,
  PendingApproval,
  UIMessage,
  UIMessagePart,
  UIMessageToolPart,
} from "./agent.types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export const agentService = {
  async createSession(input: CreateSessionInput) {
    return trpc.agent.createSession.mutate(input);
  },

  async getSessionHistory(sessionId: string) {
    return trpc.agent.getSessionHistory.query({ sessionId });
  },

  async listSessions(input?: ListSessionsInput) {
    return trpc.agent.listSessions.query(input ?? {});
  },

  async stream(
    messages: UIMessage[],
    repoId?: string,
    sessionId?: string,
  ): Promise<{
    assistantMessage: UIMessage;
    fullText: string;
    pendingApprovals: PendingApproval[];
  }> {
    const token = getToken();
    const apiUrl = getApiUrl();
    const s = p.spinner();

    s.start("AI is processing request...");

    const response = await fetch(`${apiUrl}/agent/chat`, {
      body: JSON.stringify({
        currentRepoId: repoId,
        messages: messages.map((m) => ({
          id: m.id,
          parts: m.parts,
          role: m.role,
        })),
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
    const decoder = new TextDecoder("utf-8");
    let fullText = "";
    let buffer = "";
    let lineBuffer = "";
    let isSpinnerRunning = true;
    let hasPrintedHeader = false;

    resetMarkdownState();

    const toolPartsMap = new Map<string, UIMessageToolPart>();

    const stopSpinner = () => {
      if (isSpinnerRunning) {
        s.stop();
        isSpinnerRunning = false;
      }
    };

    const ensureHeader = () => {
      stopSpinner();
      if (!hasPrintedHeader) {
        process.stdout.write(`\n${brand.logo("Doxynix AI:")}\n`);
        hasPrintedHeader = true;
      }
    };

    const flushLineBuffer = () => {
      if (lineBuffer.length > 0) {
        process.stdout.write(renderMarkdownLine(lineBuffer) + "\n");
        lineBuffer = "";
      }
    };

    const dispatchPayload = (payload: string) => {
      const trimmed = payload.trim();
      if (!trimmed || trimmed === "[DONE]") {
        return;
      }

      try {
        const event: unknown = JSON.parse(trimmed);
        if (!isRecord(event)) {
          return;
        }

        if (event.type === "text-delta" && typeof event.delta === "string") {
          ensureHeader();
          fullText += event.delta;
          lineBuffer += event.delta;

          if (lineBuffer.includes("\n")) {
            const lines = lineBuffer.split("\n");
            lineBuffer = lines.pop() ?? "";
            for (const line of lines) {
              process.stdout.write(renderMarkdownLine(line) + "\n");
            }
          }
        } else if (event.type === "tool-input-start" || event.type === "tool-call") {
          flushLineBuffer();

          const toolCallId =
            typeof event.toolCallId === "string" ? event.toolCallId : crypto.randomUUID();
          const toolName = typeof event.toolName === "string" ? event.toolName : "tool";

          toolPartsMap.set(toolCallId, {
            args: {},
            state: "input-available",
            toolCallId,
            toolName,
            type: `tool-${toolName}`,
          });

          ensureHeader();
          process.stdout.write(
            `\n${icons.pending} ${pc.yellow("[Tool Call]:")} ${pc.bold(toolName)}...\n`,
          );
        } else if (event.type === "tool-input-available") {
          flushLineBuffer();

          const toolCallId = typeof event.toolCallId === "string" ? event.toolCallId : "";
          const existing = toolPartsMap.get(toolCallId);
          if (existing) {
            existing.args = isRecord(event.input) ? event.input : {};
          }
          process.stdout.write(pc.gray(`   Arguments: ${JSON.stringify(event.input)}\n`));
        } else if (event.type === "tool-approval-request") {
          flushLineBuffer();

          const toolCallId = typeof event.toolCallId === "string" ? event.toolCallId : "";
          let approvalId = toolCallId;
          if (typeof event.approvalId === "string") {
            approvalId = event.approvalId;
          } else if (isRecord(event.approval) && typeof event.approval.id === "string") {
            approvalId = event.approval.id;
          }

          const existing = toolPartsMap.get(toolCallId);
          if (existing) {
            existing.state = "approval-requested";
            existing.approval = { approved: false, id: approvalId };
          }
          process.stdout.write(pc.yellow(`   ${icons.warning} Approval required from user...\n`));
        } else if (event.type === "tool-output-available") {
          flushLineBuffer();

          const toolCallId = typeof event.toolCallId === "string" ? event.toolCallId : "";
          const existing = toolPartsMap.get(toolCallId);
          if (existing) {
            existing.state = "output-available";
            existing.output = event.output;
          }
          const out =
            typeof event.output === "string"
              ? event.output
              : event.output !== null && event.output !== undefined
                ? JSON.stringify(event.output)
                : "";
          process.stdout.write(
            `${icons.check} ${pc.green("[Tool Result]:")} ${pc.gray(out.slice(0, 150))}\n`,
          );
        } else if (event.type === "error") {
          flushLineBuffer();
          ensureHeader();
          const errStr = typeof event.error === "string" ? event.error : JSON.stringify(event);
          const errorMsg = brand.error(`Generation error: ${errStr}`);
          process.stdout.write(`\n${errorMsg}\n`);
        }
      } catch {
        if (!trimmed.startsWith("{")) {
          ensureHeader();
          fullText += trimmed;
          lineBuffer += trimmed;

          if (lineBuffer.includes("\n")) {
            const lines = lineBuffer.split("\n");
            lineBuffer = lines.pop() ?? "";
            for (const line of lines) {
              process.stdout.write(renderMarkdownLine(line) + "\n");
            }
          }
        }
      }
    };

    let currentEventData: string[] = [];

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          buffer += decoder.decode();
          if (buffer.length > 0) {
            const finalLines = buffer.split(/\r\n|\r|\n/);
            for (const line of finalLines) {
              if (line === "") {
                if (currentEventData.length > 0) {
                  dispatchPayload(currentEventData.join("\n"));
                  currentEventData = [];
                }
              } else if (line.startsWith("data:")) {
                let dataValue = line.slice(5);
                if (dataValue.startsWith(" ")) {
                  dataValue = dataValue.slice(1);
                }
                currentEventData.push(dataValue);
              }
            }
          }
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split(/\r\n|\r|\n/);
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (line === "") {
            if (currentEventData.length > 0) {
              dispatchPayload(currentEventData.join("\n"));
              currentEventData = [];
            }
            continue;
          }

          if (line.startsWith(":")) {
            continue;
          }

          if (line.startsWith("data:")) {
            let dataValue = line.slice(5);
            if (dataValue.startsWith(" ")) {
              dataValue = dataValue.slice(1);
            }
            currentEventData.push(dataValue);
          }
        }
      }

      if (currentEventData.length > 0) {
        dispatchPayload(currentEventData.join("\n"));
      }
    } finally {
      stopSpinner();
      if (lineBuffer.length > 0) {
        process.stdout.write(renderMarkdownLine(lineBuffer) + "\n");
        lineBuffer = "";
      } else if (hasPrintedHeader) {
        process.stdout.write("\n");
      }
    }

    const parts: UIMessagePart[] = [];
    if (fullText.trim().length > 0) {
      parts.push({ text: fullText, type: "text" });
    }
    for (const toolPart of toolPartsMap.values()) {
      parts.push(toolPart);
    }

    const assistantMessage: UIMessage = {
      id: crypto.randomUUID(),
      parts,
      role: "assistant",
    };

    const pendingApprovals: PendingApproval[] = Array.from(toolPartsMap.values())
      .filter((tp) => tp.state === "approval-requested")
      .map((tp) => ({
        approvalId: tp.approval?.id ?? tp.toolCallId,
        input: tp.args,
        toolCallId: tp.toolCallId,
        toolName: tp.toolName,
      }));

    return {
      assistantMessage,
      fullText,
      pendingApprovals,
    };
  },
};
