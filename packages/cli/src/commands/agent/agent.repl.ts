import * as p from "@clack/prompts";

import { guardPrompt } from "@/core/prompts";

import { brand, pc } from "@/ui/colors";

import { reposService } from "../repos/repos.service";
import { agentService } from "./agent.service";
import type { UIMessage, UIMessageToolPart } from "./agent.types";

export async function startInteractiveChat(initialRepoTarget?: string) {
  p.intro(brand.logo(" Doxynix AI Engineering Assistant "));

  let selectedRepoId: string | undefined;
  let selectedRepoName = "Global Context";

  if (initialRepoTarget) {
    const [owner, name] = initialRepoTarget.split("/");
    if (!owner || !name) {
      p.outro(brand.error("Format must be: owner/name (e.g. facebook/react)"));
      return;
    }
    const repo = await reposService.getByName(owner, name);
    if (!repo) {
      p.outro(brand.error(`Repository '${initialRepoTarget}' not found.`));
      return;
    }
    selectedRepoId = repo.id;
    selectedRepoName = `${repo.owner}/${repo.name}`;
  } else {
    const reposRes = await reposService.list({
      limit: 25,
      sortBy: "createdAt",
      sortOrder: "desc",
    });

    const choices = [
      { label: "Global Mode (All repositories / General questions)", value: "global" },
      ...reposRes.items.map((r) => ({
        label: `${r.owner}/${r.name} (${r.language ?? "Other"})`,
        value: r.id,
      })),
    ];

    const contextChoice = await guardPrompt(
      p.select({
        message: "Select workspace context for AI assistant:",
        options: choices,
      }),
      "Chat cancelled.",
    );

    if (contextChoice !== "global" && typeof contextChoice === "string") {
      selectedRepoId = contextChoice;
      const found = reposRes.items.find((r) => r.id === selectedRepoId);
      if (found) {
        selectedRepoName = `${found.owner}/${found.name}`;
      }
    }
  }

  let sessionId: string | undefined;
  try {
    const session = await agentService.createSession({
      repoId: selectedRepoId,
      title: `CLI: ${selectedRepoName}`,
    });
    sessionId = session.id;
  } catch {
    // Session is optional
  }

  p.note(
    `Context:   ${pc.cyan(selectedRepoName)}\n` +
      `Commands:  ${pc.gray("Type '/exit' to quit, '/clear' to reset chat history")}`,
    "Session Started",
  );

  const history: UIMessage[] = [];

  while (true) {
    const input = await p.text({
      message: brand.highlight("You:"),
      placeholder: "e.g. Revoke leaked API key or explain project structure",
    });

    if (typeof input !== "string" || p.isCancel(input)) {
      p.outro(brand.muted("Goodbye! Session closed."));
      break;
    }

    const trimmedInput = input.trim();

    if (trimmedInput === "/exit" || trimmedInput === "exit") {
      p.outro(brand.muted("Goodbye! Session closed."));
      break;
    }

    if (!trimmedInput) {
      continue;
    }

    if (trimmedInput === "/clear") {
      history.length = 0;
      p.log.info(brand.muted("Conversation history cleared."));
      continue;
    }

    history.push({
      id: crypto.randomUUID(),
      parts: [{ text: trimmedInput, type: "text" }],
      role: "user",
    });

    try {
      await executeTurn(history, selectedRepoId, sessionId);
    } catch (error: unknown) {
      history.pop();
      const message = error instanceof Error ? error.message : String(error);
      p.log.error(message);
    }
  }
}

export async function executeTurn(
  history: UIMessage[],
  repoId?: string,
  sessionId?: string,
): Promise<void> {
  let streamResult = await agentService.stream(history, repoId, sessionId);
  history.push(streamResult.assistantMessage);

  while (streamResult.pendingApprovals.length > 0) {
    const currentApprovals = [...streamResult.pendingApprovals];

    for (const approval of currentApprovals) {
      const isApproved = await p.confirm({
        active: "Yes, execute action",
        inactive: "Decline",
        message: brand.warning(
          `Agent requests confirmation to execute: ${brand.highlight(approval.toolName)}\n` +
            `   Parameters: ${pc.gray(JSON.stringify(approval.input))}\n` +
            `   Approve execution?`,
        ),
      });

      const approved = Boolean(isApproved && !p.isCancel(isApproved));

      const toolPart = streamResult.assistantMessage.parts.find(
        (part): part is UIMessageToolPart =>
          "toolCallId" in part && part.toolCallId === approval.toolCallId,
      );

      if (toolPart) {
        toolPart.state = "approval-responded";
        toolPart.approval = {
          approved,
          id: approval.approvalId,
          reason: approved ? undefined : "Denied by user in CLI",
        };
      }

      p.log.step(
        approved
          ? brand.success(`Approved ${approval.toolName}. Processing...`)
          : brand.muted(`Declined ${approval.toolName}.`),
      );
    }

    streamResult = await agentService.stream(history, repoId, sessionId);
    history.push(streamResult.assistantMessage);
  }
}
