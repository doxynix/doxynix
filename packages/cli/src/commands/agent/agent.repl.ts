import * as p from "@clack/prompts";

import { trpc } from "@/core/client";

import { brand, pc } from "@/ui/colors";

import { AgentStreamClient, type ChatMessage } from "./agent.service";
import { executeClientAction } from "./agent.tools";

export async function startInteractiveChat(initialRepoTarget?: string) {
  p.intro(brand.logo(" 🤖 Doxynix AI Engineering Assistant "));

  let selectedRepoId: string | undefined;
  let selectedRepoName = "Global Context";

  if (initialRepoTarget) {
    const [owner, name] = initialRepoTarget.split("/");
    if (owner && name) {
      const repo = await trpc.repo.getByName.query({ name, owner });
      if (repo) {
        selectedRepoId = repo.id;
        selectedRepoName = `${repo.owner}/${repo.name}`;
      }
    }
  } else {
    const reposRes = await trpc.repo.getAll.query({
      limit: 50,
      sortBy: "createdAt",
      sortOrder: "desc",
    });

    const choices = [
      { label: "🌐 Global Mode (All repositories / General questions)", value: "global" },
      ...reposRes.items.map((r) => ({
        label: `📦 ${r.owner}/${r.name} (${r.language ?? "Other"})`,
        value: r.id,
      })),
    ];

    const contextChoice = await p.select({
      message: "Select workspace context for AI assistant:",
      options: choices,
    });

    if (p.isCancel(contextChoice)) {
      p.cancel("Chat cancelled.");
      return;
    }

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
    const session = await trpc.agent.createSession.mutate({
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

  const history: ChatMessage[] = [];

  while (true) {
    const input = await p.text({
      message: brand.highlight("You:"),
      placeholder: "e.g. Revoke leaked API key or explain project structure",
    });

    if (p.isCancel(input) || input.trim() === "/exit" || input.trim() === "exit") {
      p.outro(brand.muted("Goodbye! Session closed."));
      break;
    }

    const userMessage = input.trim();
    if (!userMessage) {
      continue;
    }

    if (userMessage === "/clear") {
      history.length = 0;
      console.log(brand.muted("\n🧹 Conversation history cleared.\n"));
      continue;
    }

    history.push({
      content: userMessage,
      id: crypto.randomUUID(),
      role: "user",
    });

    try {
      await executeTurn(history, selectedRepoId, sessionId);
      console.log("\n");
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      console.log(`\n${brand.error(`❌ Error: ${message}`)}\n`);
    }
  }
}

export async function executeTurn(
  history: ChatMessage[],
  repoId?: string,
  sessionId?: string,
): Promise<void> {
  const { fullText, pendingTools } = await AgentStreamClient.stream(history, repoId, sessionId);

  if (fullText) {
    history.push({
      content: fullText,
      id: crypto.randomUUID(),
      role: "assistant",
    });
  }

  for (const tool of pendingTools) {
    if (tool.hasExecutedOnServer) {
      continue;
    }

    console.log("\n");
    const isApproved = await p.confirm({
      active: "Yes, execute action",
      inactive: "Decline",
      message: brand.warning(
        `⚠️ Agent requests confirmation to execute: ${brand.highlight(tool.toolName)}\n` +
          `   Parameters: ${pc.gray(JSON.stringify(tool.input))}\n` +
          `   Approve execution?`,
      ),
    });

    if (isApproved && !p.isCancel(isApproved)) {
      const s = p.spinner();
      s.start(`Executing ${tool.toolName}...`);

      try {
        const result = await executeClientAction(tool.toolName, tool.input);
        s.stop(`Action ${tool.toolName} completed successfully!`);
        p.outro(brand.success(`✔ [Result]: ${result.message}`));

        history.push({
          content: `[System]: User confirmed tool execution for ${tool.toolName}. Result: ${JSON.stringify(result)}. Summarize completion.`,
          id: crypto.randomUUID(),
          role: "user",
        });

        console.log(`\n${brand.logo("Doxynix AI:")}`);
        const followUp = await AgentStreamClient.stream(history, repoId, sessionId);
        if (followUp.fullText) {
          history.push({
            content: followUp.fullText,
            id: crypto.randomUUID(),
            role: "assistant",
          });
        }
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        s.stop(`Failed executing ${tool.toolName}`);
        p.outro(brand.error(`❌ ${message}`));
      }
    } else {
      p.outro(brand.muted(`✖ Action ${tool.toolName} declined by user.`));
      history.push({
        content: `[System]: Tool action ${tool.toolName} was rejected by user.`,
        id: crypto.randomUUID(),
        role: "user",
      });
    }
  }
}
