import fs from "node:fs";
import path from "node:path";

import * as p from "@clack/prompts";
import type { Command } from "commander";

import { trpc } from "@/core/client";
import { handleCliError } from "@/core/errors";
import { resolveRepository } from "@/core/repo";

import { brand, pc } from "@/ui/colors";
import { formatScore } from "@/ui/formatters";
import { createTable } from "@/ui/table";

import { getCurrentGitBranch } from "../docs/docs.command";
import { formatStatus, renderAnalysisTable, renderRepoConfigTable } from "./analyze.formatter";
import { analyzeService } from "./analyze.service";

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

        const repoContext = await resolveRepository(
          target,
          "Select repository to run analysis on:",
        );
        if (!repoContext) {
          return;
        }

        const s = p.spinner();
        s.start(`Searching for repository ${repoContext.target}...`);
        s.message(`Dispatching pipeline job to Trigger.dev for ${repoContext.target}...`);

        const result = await trpc.analysis.analyze.mutate({
          docTypes: ["README", "ARCHITECTURE", "CODE_DOC"],
          files: [],
          language: options?.language ?? "English",
          repoId: repoContext.repo.id,
        });

        s.stop("Analysis job dispatched to cloud!");

        p.note(
          `Job ID:       ${brand.highlight(result.jobId)}\n` +
            `Status:       ${brand.info(result.status)}\n\n` +
            `To check progress, run:\n` +
            brand.highlight(`dxnx analyze status ${repoContext.target}`),
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
        const repoContext = await resolveRepository(target, "Select repository to inspect status:");
        if (!repoContext) {
          return;
        }

        const s = p.spinner();
        if (!options?.json) {
          s.start(`Fetching analysis status for ${repoContext.target}...`);
        }

        const analysis = await trpc.analysis.getLatest.query({ repoId: repoContext.repo.id });
        if (!options?.json) {
          s.stop("Status retrieved");
        }

        if (options?.json) {
          console.log(JSON.stringify(analysis, null, 2));
          return;
        }

        if (!analysis) {
          p.outro(
            brand.warning(
              `No analysis runs found for ${repoContext.target}.\nRun an analysis with: `,
            ) + brand.highlight(`dxnx analyze start ${repoContext.target}`),
          );
          return;
        }

        console.log(`\n  📊 Repository Analysis: ${brand.highlight(repoContext.target)}`);
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

  analyze
    .command("cancel <analysisId>")
    .description("Abort an in-flight analysis job by its UUID")
    .action(async (analysisId: string) => {
      try {
        p.intro(brand.warning(" 🛑 Abort Repository Analysis "));

        const confirmed = await p.confirm({
          message: `Are you sure you want to cancel analysis ${brand.highlight(analysisId)}?`,
        });

        if (!confirmed || p.isCancel(confirmed)) {
          p.cancel("Abortion cancelled.");
          return;
        }

        const s = p.spinner();
        s.start("Terminating cloud analysis run...");
        await trpc.analysis.cancel.mutate({ analysisId });
        s.stop("Analysis job cancelled");

        p.outro(brand.success("✔ Analysis pipeline has been successfully terminated."));
      } catch (error) {
        handleCliError(error);
      }
    });

  analyze
    .command("history [target]")
    .description("View the history of all analysis runs for a repository")
    .option("--json", "Output history in JSON format")
    .action(async (target?: string, options?: { json?: boolean }) => {
      try {
        const repoContext = await resolveRepository(
          target,
          "Select repository to view run history:",
        );
        if (!repoContext) {
          return;
        }

        const s = p.spinner();
        if (!options?.json) {
          s.start(`Loading history for ${repoContext.target}...`);
        }

        const history = await trpc.analysis.getHistory.query({ repoId: repoContext.repo.id });
        if (!options?.json) {
          s.stop("History loaded");
        }

        if (options?.json) {
          console.log(JSON.stringify(history, null, 2));
          return;
        }

        const items = Array.isArray(history) ? history : ((history as any)?.items ?? []);

        if (items.length === 0) {
          p.outro(brand.muted(`No previous analysis runs found for ${repoContext.target}.`));
          return;
        }

        const table = createTable(["Run ID", "Status", "Date", "Score", "Branch"]);
        for (const run of items) {
          table.push([
            brand.muted(run.publicId ? `${run.publicId.slice(0, 8)}...` : run.id),
            formatStatus(run.status),
            new Date(run.createdAt).toLocaleDateString(),
            formatScore(run.score ?? run.securityScore),
            brand.info(run.branch ?? "default"),
          ]);
        }

        console.log(`\n  📜 Run History: ${brand.highlight(repoContext.target)}\n`);
        console.log(table.toString());
        console.log("\n");
        p.outro(brand.muted(`Total runs: ${items.length}`));
      } catch (error) {
        handleCliError(error);
      }
    });

  // dxnx analyze audit <filePath>
  analyze
    .command("audit <filePath>")
    .description("Run a fast on-demand AI security and code-quality audit for a single file")
    .option("-r, --repo <target>", "Repository context (owner/name)")
    .option("-b, --branch <branch>", "Git branch name")
    .option("--json", "Output raw JSON result")
    .action(
      async (filePath: string, options: { branch?: string; json?: boolean; repo?: string }) => {
        try {
          p.intro(brand.logo(" 🛡️ Single-File Security Audit "));

          const repoContext = await resolveRepository(
            options.repo,
            "Select repository context for this file audit:",
          );
          if (!repoContext) {
            return;
          }

          const localPath = path.resolve(process.cwd(), filePath);
          let content = "";

          if (fs.existsSync(localPath) && fs.statSync(localPath).isFile()) {
            content = fs.readFileSync(localPath, "utf-8");
          } else {
            const inputContent = await p.text({
              message: `File '${filePath}' not found locally. Paste file content:`,
              validate: (v) => (!v?.trim() ? "Content cannot be empty" : undefined),
            });
            if (p.isCancel(inputContent)) {
              p.cancel("Cancelled.");
              return;
            }
            content = inputContent;
          }

          const branch = options.branch ?? getCurrentGitBranch();

          const s = p.spinner();
          if (!options.json) {
            s.start(`Auditing ${pc.cyan(filePath)} via AST & Security Engine...`);
          }

          const result = await analyzeService.quickFileAudit({
            branch,
            content,
            path: filePath,
            repoId: repoContext.repo.id,
          });

          if (!options.json) {
            s.stop("File audit complete!");
          }

          if (options.json) {
            console.log(JSON.stringify(result, null, 2));
            return;
          }

          const report =
            typeof result === "string"
              ? result
              : ((result as any)?.content ??
                (result as any)?.report ??
                JSON.stringify(result, null, 2));

          console.log(`\n${brand.info(`=== Audit Report: ${filePath} ===`)}\n`);
          console.log(report);
          console.log(`\n${brand.info("=== End of Audit Report ===")}\n`);

          p.outro(brand.success("✔ File audit finished!"));
        } catch (error) {
          handleCliError(error);
        }
      },
    );

  // dxnx analyze config [target]
  analyze
    .command("config [target]")
    .description("View repository PR analysis configuration and security policies")
    .option("--json", "Output config in JSON format")
    .action(async (target?: string, options?: { json?: boolean }) => {
      try {
        const repoContext = await resolveRepository(
          target,
          "Select repository to inspect PR configuration:",
        );
        if (!repoContext) {
          return;
        }

        const s = p.spinner();
        if (!options?.json) {
          s.start(`Fetching PR config for ${repoContext.target}...`);
        }

        const config = await analyzeService.getRepoConfig(repoContext.repo.id);
        if (!options?.json) {
          s.stop("Config loaded");
        }

        if (options?.json) {
          console.log(JSON.stringify(config, null, 2));
          return;
        }

        console.log(
          `\n${brand.logo(` ⚙️ Pull Request Analysis Settings: ${repoContext.target}\n`)}`,
        );
        console.log(renderRepoConfigTable(config ?? {}));
        console.log("\n");
        p.outro(brand.muted(`Update settings with: dxnx analyze config-set ${repoContext.target}`));
      } catch (error) {
        handleCliError(error);
      }
    });

  // dxnx analyze config-set [target]
  analyze
    .command("config-set [target]")
    .description("Interactively update repository PR automation and security settings")
    .action(async (target?: string) => {
      try {
        p.intro(brand.logo(" ⚙️ Configure PR Automation "));

        const repoContext = await resolveRepository(target, "Select repository to configure:");
        if (!repoContext) {
          return;
        }

        const currentConfig = (await analyzeService.getRepoConfig(repoContext.repo.id)) ?? {};

        const enabled = await p.confirm({
          initialValue: currentConfig.enabled ?? true,
          message: "Enable automated Pull Request reviews on GitHub?",
        });
        if (p.isCancel(enabled)) {
          return p.cancel("Configuration aborted.");
        }

        const commentStyle = await p.select({
          initialValue: currentConfig.commentStyle ?? "DETAILED",
          message: "Select PR Comment Style:",
          options: [
            {
              label: "Detailed (Full review with code snippets & fix suggestions)",
              value: "DETAILED",
            },
            { label: "Concise (Only critical security flaws & blocker notes)", value: "CONCISE" },
            { label: "Off (Disable automated PR review comments)", value: "OFF" },
          ],
        });
        if (p.isCancel(commentStyle) || typeof commentStyle !== "string") {
          return p.cancel("Aborted.");
        }

        const ciSkip = await p.confirm({
          initialValue: currentConfig.ciSkip ?? false,
          message: "Allow skipping PR analysis using [skip ci] in commit message?",
        });
        if (p.isCancel(ciSkip)) {
          return p.cancel("Aborted.");
        }

        const tokenBudgetInput = await p.text({
          defaultValue: String(currentConfig.tokenBudget ?? 50_000),
          message: "Max AI Token Budget per Pull Request run (10000 - 100000):",
          validate: (v) => {
            const num = Number(v);
            if (!Number.isInteger(num) || num < 10_000 || num > 100_000) {
              return "Must be an integer between 10000 and 100000";
            }
            return undefined;
          },
        });
        if (p.isCancel(tokenBudgetInput)) {
          return p.cancel("Aborted.");
        }

        const s = p.spinner();
        s.start("Saving repository configuration...");

        await analyzeService.configureRepository({
          ciSkip: Boolean(ciSkip),
          commentStyle: commentStyle as any,
          enabled: Boolean(enabled),
          repoId: repoContext.repo.id,
          tokenBudget: Number(tokenBudgetInput),
        });

        s.stop("Configuration applied!");
        p.outro(
          brand.success(
            `✔ PR Analysis settings updated for ${brand.highlight(repoContext.target)}!`,
          ),
        );
      } catch (error) {
        handleCliError(error);
      }
    });
}
