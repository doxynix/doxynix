import * as p from "@clack/prompts";
import type { Command } from "commander";

import { getToken } from "@/core/config";
import { handleCliError } from "@/core/errors";
import { parseRepoTarget } from "@/core/repo";

import { brand, pc } from "@/ui/colors";
import { withTaskSpinner } from "@/ui/spinner";

import { reposService } from "../repos/repos.service";
import { extractMessageContent, renderSessionsTable } from "./agent.formatter";
import { executeTurn, startInteractiveChat } from "./agent.repl";
import { agentService } from "./agent.service";
import type { ChatMessage, ChatSessionItem } from "./agent.types";

export function registerAgentCommand(program: Command) {
  const agent = program
    .command("agent")
    .alias("chat")
    .description("🤖 Interactive AI Engineering Assistant (AST analysis, Security, Refactoring)")
    .argument("[prompt...]", "Single-turn prompt query")
    .option("-r, --repo <target>", "Repository context (owner/name)")
    .action(async (promptParts: string[], options: { repo?: string }) => {
      try {
        const token = getToken();
        if (!token) {
          p.outro(
            brand.warning("⚠️ You are not authenticated.\n") +
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

          p.intro(
            brand.logo(` 🤖 Doxynix AI Agent ${options.repo ? pc.cyan(`(${options.repo})`) : ""} `),
          );
          console.log(`\n${brand.highlight("You:")} ${prompt}\n`);

          const userMsg: ChatMessage = {
            content: prompt,
            id: crypto.randomUUID(),
            role: "user",
          };

          await executeTurn([userMsg], repoId);
          console.log("\n");
          p.outro(brand.success("Done!"));
          return;
        }

        await startInteractiveChat(options.repo);
      } catch (error) {
        handleCliError(error);
      }
    });

  agent
    .command("sessions")
    .description("List previous AI assistant chat sessions")
    .option("-r, --repo <target>", "Filter by repository context (owner/name)")
    .option("--json", "Output sessions in raw JSON format")
    .action(async (options: { json?: boolean; repo?: string }) => {
      try {
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

        if (options.json) {
          console.log(JSON.stringify(sessions, null, 2));
          return;
        }

        if (sessions.length === 0) {
          p.outro(brand.muted("No chat sessions found. Start one with: dxnx agent"));
          return;
        }

        console.log(`\n${brand.logo(" 📜 AI Chat Sessions:\n")}`);
        console.log(renderSessionsTable(sessions));
        console.log("\n");

        p.outro(
          brand.muted("Inspect messages with: ") +
            brand.highlight("dxnx agent history [sessionId]"),
        );
      } catch (error) {
        handleCliError(error);
      }
    });

  agent
    .command("history [sessionId]")
    .description("Inspect session dialogue (supports Short-ID prefix and interactive pick)")
    .option("--json", "Output history in JSON format")
    .action(async (sessionIdArg?: string, options?: { json?: boolean }) => {
      try {
        let targetSessionId = sessionIdArg?.trim();

        if (!targetSessionId || targetSessionId.length < 32) {
          const sessions = await withTaskSpinner("Fetching recent sessions for resolution...", () =>
            agentService.listSessions({}),
          );

          if (sessions.length === 0) {
            p.outro(brand.muted("No chat sessions found."));
            return;
          }

          if (targetSessionId) {
            const prefix = targetSessionId.toLowerCase();
            const match = sessions.find((item: ChatSessionItem) =>
              item.id.toLowerCase().startsWith(prefix),
            );
            if (!match) {
              p.outro(brand.error(`No session found matching prefix: '${targetSessionId}'`));
              return;
            }
            targetSessionId = match.id;
          } else {
            const selection = await p.select({
              message: "Select an AI chat session to inspect history:",
              options: sessions.map((item: ChatSessionItem) => ({
                label: `${item.title} (${item.repo ? `${item.repo.owner}/${item.repo.name}` : "Global"}) [${item.id.slice(0, 8)}]`,
                value: item.id,
              })),
            });

            if (p.isCancel(selection) || typeof selection !== "string") {
              p.cancel("Inspection cancelled.");
              return;
            }
            targetSessionId = selection;
          }
        }

        const messages = await withTaskSpinner(
          {
            silent: options?.json,
            start: `Retrieving history for session ${brand.highlight(targetSessionId.slice(0, 8))}...`,
            stop: "History loaded",
          },
          () => agentService.getSessionHistory(targetSessionId),
        );

        if (options?.json) {
          console.log(JSON.stringify(messages, null, 2));
          return;
        }

        if (messages.length === 0) {
          p.outro(brand.muted("No messages recorded in this session."));
          return;
        }

        console.log(
          `\n${brand.logo(` 📜 Session History (${targetSessionId.slice(0, 8)}...):\n`)}`,
        );

        for (const msg of messages) {
          const isUser = msg.role === "user";
          const senderLabel = isUser ? brand.highlight("You:") : brand.logo("Doxynix AI:");
          const text = extractMessageContent(msg.parts);

          console.log(`${senderLabel}\n${text}\n`);
          console.log(brand.muted("────────────────────────────────────────\n"));
        }

        p.outro(brand.muted(`Total messages: ${messages.length}`));
      } catch (error) {
        handleCliError(error);
      }
    });
}
