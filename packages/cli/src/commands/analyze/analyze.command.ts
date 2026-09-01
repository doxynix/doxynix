import * as p from "@clack/prompts";
import type { Command } from "commander";

import { trpc } from "@/core/client";
import { handleCliError } from "@/core/errors";

import { brand } from "@/ui/colors";

import { formatStatus, renderAnalysisTable } from "./analyze.formatter";

export function registerAnalyzeCommand(program: Command) {
  const analyze = program
    .command("analyze")
    .description("Trigger and monitor repository security and code quality analysis");

  analyze
    .command("start [target]")
    .description("Trigger deep code analysis (e.g. dxnx analyze start owner/repo)")
    .option("-l, --language <lang>", "Documentation language (English, Russian)", "English")
    .action(async (target?: string, options?: { language?: string }) => {
      try {
        p.intro(brand.logo(" 🛡️ Trigger Doxynix Analysis "));

        let repoTarget = target;

        if (!repoTarget) {
          const res = await trpc.repo.getAll.query({
            limit: 50,
            sortBy: "createdAt",
            sortOrder: "desc",
          });

          if (res.items.length === 0) {
            p.outro(
              brand.muted("Connect a repository first: ") + brand.highlight("dxnx repos add <url>"),
            );
            return;
          }

          const selection = await p.select({
            message: "Select repository to run analysis on:",
            options: res.items.map((r) => ({
              label: `${r.owner}/${r.name} (${r.language ?? "Other"})`,
              value: `${r.owner}/${r.name}`,
            })),
          });

          if (p.isCancel(selection)) {
            p.cancel("Analysis cancelled.");
            return;
          }

          if (typeof selection === "string") {
            repoTarget = selection;
          }
        }

        const [owner, name] = repoTarget ? repoTarget.split("/") : [];
        if (!owner || !name) {
          p.outro(brand.error("Format must be: owner/name (e.g. facebook/react)"));
          return;
        }

        const s = p.spinner();
        s.start(`Searching for repository ${repoTarget}...`);

        const repo = await trpc.repo.getByName.query({ name, owner });
        if (!repo) {
          s.stop("Repository not found");
          p.outro(brand.error(`Repository ${repoTarget} was not found in your account.`));
          return;
        }

        s.message(`Dispatching pipeline job to Trigger.dev for ${repoTarget}...`);

        const result = await trpc.analysis.analyze.mutate({
          docTypes: ["README", "ARCHITECTURE", "CODE_DOC"],
          files: [],
          language: options?.language ?? "English",
          repoId: repo.id,
        });

        s.stop("Analysis job dispatched to cloud!");

        p.note(
          `Job ID:       ${brand.highlight(result.jobId)}\n` +
            `Status:       ${brand.info(result.status)}\n\n` +
            `To check progress, run:\n` +
            brand.highlight(`dxnx analyze status ${repoTarget}`),
          "Pipeline Dispatched",
        );

        p.outro(brand.success("🚀 AST Scanner & AI Engine have started code verification."));
      } catch (error) {
        handleCliError(error);
      }
    });

  analyze
    .command("status [target]")
    .description("Check current status and security scores for repository")
    .option("--json", "Output in JSON format")
    .action(async (target?: string, options?: { json?: boolean }) => {
      try {
        let repoTarget = target;

        if (!repoTarget) {
          const res = await trpc.repo.getAll.query({
            limit: 50,
            sortBy: "createdAt",
            sortOrder: "desc",
          });

          if (res.items.length === 0) {
            p.outro(brand.muted("No connected repositories found."));
            return;
          }

          const selection = await p.select({
            message: "Select repository to inspect status:",
            options: res.items.map((r) => ({
              label: `${r.owner}/${r.name}`,
              value: `${r.owner}/${r.name}`,
            })),
          });

          if (p.isCancel(selection)) {
            p.cancel("Cancelled.");
            return;
          }

          if (typeof selection === "string") {
            repoTarget = selection;
          }
        }

        const [owner, name] = repoTarget ? repoTarget.split("/") : [];
        if (!owner || !name) {
          p.outro(brand.error("Format must be: owner/name"));
          return;
        }

        const s = p.spinner();
        if (!options?.json) {
          s.start(`Fetching analysis status for ${repoTarget}...`);
        }

        const repo = await trpc.repo.getByName.query({ name, owner });
        if (!repo) {
          if (!options?.json) {
            s.stop("Repository not found");
          }
          p.outro(brand.error(`Repository ${repoTarget} was not found.`));
          return;
        }

        const analysis = await trpc.analysis.getLatest.query({ repoId: repo.id });
        if (!options?.json) {
          s.stop("Status retrieved");
        }

        if (options?.json) {
          console.log(JSON.stringify(analysis, null, 2));
          return;
        }

        if (!analysis) {
          p.outro(
            brand.warning(`No analysis runs found for ${repoTarget}.\nRun an analysis with: `) +
              brand.highlight(`dxnx analyze start ${repoTarget}`),
          );
          return;
        }

        console.log(`\n  📊 Repository Analysis: ${brand.highlight(repoTarget ?? "")}`);
        console.log(`  Status:       ${formatStatus(analysis.status)}`);
        console.log(`  Progress:     ${brand.highlight(`${analysis.progress}%`)}`);
        if (analysis.message) {
          console.log(`  Info:         ${brand.muted(analysis.message)}`);
        }

        console.log(`\n${renderAnalysisTable(analysis)}\n`);
        p.outro(brand.muted(`Last updated: ${new Date(analysis.updatedAt).toLocaleString()}`));
      } catch (error) {
        handleCliError(error);
      }
    });
}
