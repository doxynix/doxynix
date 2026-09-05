import fs from "node:fs";
import path from "node:path";

import * as p from "@clack/prompts";
import type { Command } from "commander";

import { trpc } from "@/core/client";
import { handleCliError } from "@/core/errors";

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
        let repoTarget = target;

        if (!repoTarget) {
          const res = await trpc.repo.getAll.query({
            limit: 50,
            sortBy: "createdAt",
            sortOrder: "desc",
          });
          if (res.items.length === 0) {
            p.outro(brand.muted("No repositories found."));
            return;
          }

          const selection = await p.select({
            message: "Select repository to view run history:",
            options: res.items.map((r) => ({
              label: `${r.owner}/${r.name}`,
              value: `${r.owner}/${r.name}`,
            })),
          });

          if (p.isCancel(selection) || typeof selection !== "string") {
            p.cancel("Cancelled.");
            return;
          }
          repoTarget = selection;
        }

        const [owner, name] = repoTarget.split("/");
        const s = p.spinner();
        if (!options?.json) {
          s.start(`Loading history for ${repoTarget}...`);
        }

        const repo = await trpc.repo.getByName.query({ name: name!, owner: owner! });
        if (!repo) {
          if (!options?.json) {
            s.stop("Not found");
          }
          p.outro(brand.error(`Repository ${repoTarget} not found.`));
          return;
        }

        const history = await trpc.analysis.getHistory.query({ repoId: repo.id });
        if (!options?.json) {
          s.stop("History loaded");
        }

        if (options?.json) {
          console.log(JSON.stringify(history, null, 2));
          return;
        }

        const items = Array.isArray(history) ? history : ((history as any)?.items ?? []);

        if (items.length === 0) {
          p.outro(brand.muted(`No previous analysis runs found for ${repoTarget}.`));
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

        console.log(`\n  📜 Run History: ${brand.highlight(repoTarget)}\n`);
        console.log(table.toString());
        console.log("\n");
        p.outro(brand.muted(`Total runs: ${items.length}`));
      } catch (error) {
        handleCliError(error);
      }
    });
  // 1. dxnx analyze audit <filePath>
  analyze
    .command("audit <filePath>")
    .description("Run a fast on-demand AI security and code-quality audit for a single file")
    .option("-r, --repo <target>", "Repository context (owner/name)")
    .option("-b, --branch <branch>", "Git branch name")
    .option("--json", "Output raw JSON result")
    .action(
      async (filePath: string, options: { repo?: string; branch?: string; json?: boolean }) => {
        try {
          p.intro(brand.logo(" 🛡️ Single-File Security Audit "));

          let repoTarget = options.repo;

          if (!repoTarget) {
            const res = await trpc.repo.getAll.query({
              limit: 50,
              sortBy: "createdAt",
              sortOrder: "desc",
            });
            if (res.items.length === 0) {
              p.outro(
                brand.muted("Connect a repository first: ") +
                  brand.highlight("dxnx repos add <url>"),
              );
              return;
            }

            const selection = await p.select({
              message: "Select repository context for this file audit:",
              options: res.items.map((r) => ({
                label: `${r.owner}/${r.name}`,
                value: `${r.owner}/${r.name}`,
              })),
            });

            if (p.isCancel(selection) || typeof selection !== "string") {
              p.cancel("Audit cancelled.");
              return;
            }
            repoTarget = selection;
          }

          const [owner, name] = repoTarget.split("/");
          const repo = await trpc.repo.getByName.query({ name: name!, owner: owner! });
          if (!repo) {
            p.outro(brand.error(`Repository ${repoTarget} not found in your account.`));
            return;
          }

          // Читаем локальный файл
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
            repoId: repo.id,
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

  // 2. dxnx analyze config [target] (просмотр настроек PR-анализа)
  analyze
    .command("config [target]")
    .description("View repository PR analysis configuration and security policies")
    .option("--json", "Output config in JSON format")
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
            message: "Select repository to inspect PR configuration:",
            options: res.items.map((r) => ({
              label: `${r.owner}/${r.name}`,
              value: `${r.owner}/${r.name}`,
            })),
          });

          if (p.isCancel(selection) || typeof selection !== "string") {
            p.cancel("Cancelled.");
            return;
          }
          repoTarget = selection;
        }

        const [owner, name] = repoTarget.split("/");
        const repo = await trpc.repo.getByName.query({ name: name!, owner: owner! });
        if (!repo) {
          p.outro(brand.error(`Repository ${repoTarget} was not found.`));
          return;
        }

        const s = p.spinner();
        if (!options?.json) {
          s.start(`Fetching PR config for ${repoTarget}...`);
        }

        const config = await analyzeService.getRepoConfig(repo.id);
        if (!options?.json) {
          s.stop("Config loaded");
        }

        if (options?.json) {
          console.log(JSON.stringify(config, null, 2));
          return;
        }

        console.log(`\n${brand.logo(` ⚙️ Pull Request Analysis Settings: ${repoTarget}\n`)}`);
        console.log(renderRepoConfigTable(config ?? {}));
        console.log("\n");
        p.outro(brand.muted(`Update settings with: dxnx analyze config-set ${repoTarget}`));
      } catch (error) {
        handleCliError(error);
      }
    });

  // 3. dxnx analyze config-set [target] (интерактивное изменение настроек)
  analyze
    .command("config-set [target]")
    .description("Interactively update repository PR automation and security settings")
    .action(async (target?: string) => {
      try {
        p.intro(brand.logo(" ⚙️ Configure PR Automation "));

        let repoTarget = target;
        if (!repoTarget) {
          const res = await trpc.repo.getAll.query({
            limit: 50,
            sortBy: "createdAt",
            sortOrder: "desc",
          });
          if (res.items.length === 0) {
            p.outro(brand.muted("No repositories found."));
            return;
          }

          const selection = await p.select({
            message: "Select repository to configure:",
            options: res.items.map((r) => ({
              label: `${r.owner}/${r.name}`,
              value: `${r.owner}/${r.name}`,
            })),
          });

          if (p.isCancel(selection) || typeof selection !== "string") {
            p.cancel("Cancelled.");
            return;
          }
          repoTarget = selection;
        }

        const [owner, name] = repoTarget.split("/");
        const repo = await trpc.repo.getByName.query({ name: name!, owner: owner! });
        if (!repo) {
          p.outro(brand.error(`Repository ${repoTarget} not found.`));
          return;
        }

        const currentConfig = (await analyzeService.getRepoConfig(repo.id)) ?? {};

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
            { label: "Checklist (Interactive actionable checkbox review)", value: "CHECKLIST" },
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
          message: "Max AI Token Budget per Pull Request run:",
          validate: (v) =>
            Number.isNaN(Number(v)) || Number(v) <= 0 ? "Must be a positive integer" : undefined,
        });
        if (p.isCancel(tokenBudgetInput)) {
          return p.cancel("Aborted.");
        }

        const s = p.spinner();
        s.start("Saving repository configuration...");

        await analyzeService.configureRepository({
          ciSkip: Boolean(ciSkip),
          commentStyle,
          enabled: Boolean(enabled),
          repoId: repo.id,
          tokenBudget: Number(tokenBudgetInput),
        });

        s.stop("Configuration applied!");
        p.outro(
          brand.success(`✔ PR Analysis settings updated for ${brand.highlight(repoTarget)}!`),
        );
      } catch (error) {
        handleCliError(error);
      }
    });
}
