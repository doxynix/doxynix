import * as p from "@clack/prompts";
import type { Command } from "commander";

import { trpc } from "@/core/client";
import { getToken } from "@/core/config";
import { handleCliError } from "@/core/errors";

import { brand, pc } from "@/ui/colors";

import { executeTurn, startInteractiveChat } from "./agent.repl";
import type { ChatMessage } from "./agent.service";

export function registerAgentCommand(program: Command) {
  const agent = program
    .command("agent")
    .alias("chat")
    .description(
      "🤖 Interactive AI Engineering Assistant (Security audits, AST analysis, architecture)",
    )
    .argument("[prompt...]", "Quick prompt for single-turn query (optional)")
    .option("-r, --repo <target>", "Target repository (owner/name) for context")
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
            const [owner, name] = options.repo.split("/");
            if (owner && name) {
              const repo = await trpc.repo.getByName.query({ name, owner });
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
    .description("List recent AI assistant chat sessions")
    .action(async () => {
      try {
        const s = p.spinner();
        s.start("Loading sessions...");
        const sessions = await trpc.agent.listSessions.query({});
        s.stop("Sessions retrieved");

        if (sessions.length === 0) {
          p.outro(brand.muted("No chat sessions found."));
          return;
        }

        console.log(`\n${brand.logo(" 📜 Your AI Chat Sessions:\n")}`);
        for (const session of sessions) {
          const repoLabel = session.repo
            ? pc.cyan(`[${session.repo.owner}/${session.repo.name}]`)
            : pc.gray("[Global]");
          console.log(`  ${pc.bold(session.title)} ${repoLabel}`);
          console.log(
            `  ${pc.gray(`ID: ${session.id} | ${new Date(session.updatedAt).toLocaleDateString()}`)}\n`,
          );
        }
      } catch (error) {
        handleCliError(error);
      }
    });
  agent
    .command("history <sessionId>")
    .description("Inspect message history and past dialogue of a specific chat session")
    .option("--json", "Output history in JSON format")
    .action(async (sessionId: string, options: { json?: boolean }) => {
      try {
        const s = p.spinner();
        if (!options.json) {
          s.start("Retrieving session history...");
        }

        const messages = await trpc.agent.getSessionHistory.query({ sessionId });
        if (!options.json) {
          s.stop("History loaded");
        }

        if (options.json) {
          console.log(JSON.stringify(messages, null, 2));
          return;
        }

        if (messages.length === 0) {
          p.outro(brand.muted("No messages found in this session."));
          return;
        }

        console.log(`\n${brand.logo(` 📜 Session History (${sessionId.slice(0, 8)}...):\n`)}`);

        for (const msg of messages) {
          const isUser = msg.role === "user";
          const senderLabel = isUser ? brand.highlight("You:") : brand.logo("Doxynix AI:");
          const text = Array.isArray(msg.parts)
            ? msg.parts.map((p: any) => p.text ?? "").join("\n")
            : ((msg as any).content ?? "");

          console.log(`${senderLabel}\n${text}\n`);
          console.log(brand.muted("────────────────────────────────────────\n"));
        }

        p.outro(brand.muted(`Total messages: ${messages.length}`));
      } catch (error) {
        handleCliError(error);
      }
    });
}
