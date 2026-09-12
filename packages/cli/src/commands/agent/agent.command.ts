import * as p from "@clack/prompts";
import type { Command } from "commander";

import { getToken } from "@/core/config";
import { resolveEntityOrPick } from "@/core/prompts";
import { parseRepoTarget } from "@/core/repo";

import { brand, pc } from "@/ui/colors";
import { renderSection } from "@/ui/layout";
import { output } from "@/ui/output";
import { withTaskSpinner } from "@/ui/spinner";

import { reposService } from "../repos/repos.service";
import { renderSessionHistory, renderSessionsTable } from "./agent.formatter";
import { executeTurn, startInteractiveChat } from "./agent.repl";
import { agentService } from "./agent.service";
import type { ChatSessionItem, UIMessage } from "./agent.types";

export function registerAgentCommand(program: Command) {
  const agent = program
    .command("agent")
    .alias("chat")
    .description("Interactive AI Engineering Assistant (AST analysis, Security, Refactoring)")
    .argument("[prompt...]", "Single-turn prompt query")
    .option("-r, --repo <target>", "Repository context (owner/name)")
    .action(async (promptParts: string[], options: { repo?: string }) => {
      const token = getToken();
      if (!token) {
        p.outro(
          brand.warning("You are not authenticated.\n") +
            brand.muted("Run ") +
            brand.highlight("dxnx login") +
            brand.muted(" to sign in."),
        );
        return;
      }

      if (promptParts.length > 0) {
        const prompt = promptParts.join(" ");
        let repoId: string | undefined;

        if (options.repo) {
          const parsed = parseRepoTarget(options.repo);
          if (parsed) {
            const repo = await reposService.getByName(parsed.owner, parsed.name);
            repoId = repo?.id;
          }
        }

        p.intro(brand.logo(`Doxynix AI Agent ${options.repo ? pc.cyan(options.repo) : ""} `));
        console.log(renderSection(brand.highlight("You:"), prompt));

        const userMsg: UIMessage = {
          id: crypto.randomUUID(),
          parts: [{ text: prompt, type: "text" }],
          role: "user",
        };

        await executeTurn([userMsg], repoId);
        p.outro(brand.success("Done!"));
        return;
      }

      await startInteractiveChat(options.repo);
    });

  agent
    .command("sessions")
    .description("List previous AI assistant chat sessions")
    .option("-r, --repo <target>", "Filter by repository context (owner/name)")
    .option("--json", "Output sessions in raw JSON format")
    .action(async (options: { json?: boolean; repo?: string }) => {
      let currentRepo: { name: string; owner: string } | undefined;

      if (options.repo) {
        const parsed = parseRepoTarget(options.repo);
        if (!parsed) {
          p.outro(brand.error("Format must be: owner/name (e.g. facebook/react)"));
          return;
        }
        currentRepo = parsed;
      }

      const sessions = await withTaskSpinner(
        {
          silent: options.json,
          start: currentRepo
            ? `Loading sessions for ${pc.cyan(`${currentRepo.owner}/${currentRepo.name}`)}...`
            : "Loading global sessions...",
          stop: "Sessions retrieved",
        },
        () => agentService.listSessions(currentRepo ? { currentRepo } : {}),
      );

      if (output.json(sessions, options.json)) {
        return;
      }

      if (sessions.length === 0) {
        p.outro(brand.muted("No chat sessions found. Start one with: dxnx agent"));
        return;
      }

      console.log(renderSection(brand.logo("AI Chat Sessions:"), renderSessionsTable(sessions)));

      p.outro(
        brand.muted("Inspect messages with: ") + brand.highlight("dxnx agent history [sessionId]"),
      );
    });

  agent
    .command("history [sessionId]")
    .description("Inspect session dialogue (supports Short-ID prefix and interactive pick)")
    .option("--json", "Output history in JSON format")
    .action(async (sessionIdArg?: string, options?: { json?: boolean }) => {
      const targetSessionId = await resolveEntityOrPick({
        cancelMessage: "Inspection cancelled.",
        emptyMessage: "No chat sessions found.",
        fetchItems: () =>
          withTaskSpinner("Fetching recent sessions for resolution...", () =>
            agentService.listSessions({}),
          ),
        getLabel: (item: ChatSessionItem) => {
          const repoContext = item.repo ? `${item.repo.owner}/${item.repo.name}` : "Global";
          return `${item.title} (${repoContext}) [${item.id.slice(0, 8)}]`;
        },
        idArg: sessionIdArg,
        notFoundMessage: (prefix) => `No session found matching prefix: '${prefix}'`,
        selectMessage: "Select an AI chat session to inspect history:",
      });

      if (!targetSessionId) {
        return;
      }

      const messages = await withTaskSpinner(
        {
          silent: options?.json,
          start: `Retrieving history for session ${brand.highlight(targetSessionId.slice(0, 8))}...`,
          stop: "History loaded",
        },
        () => agentService.getSessionHistory(targetSessionId),
      );

      if (output.json(messages, options?.json)) {
        return;
      }

      if (messages.length === 0) {
        p.outro(brand.muted("No messages recorded in this session."));
        return;
      }

      console.log(
        renderSection(
          brand.logo(`Session History (${targetSessionId.slice(0, 8)}...):`),
          renderSessionHistory(messages),
        ),
      );

      p.outro(brand.muted(`Total messages: ${messages.length}`));
    });
}
