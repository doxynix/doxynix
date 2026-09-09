import fs from "node:fs";
import path from "node:path";

import * as p from "@clack/prompts";
import { UpdatePRConfigInput } from "@doxynix/shared";
import { type Command } from "commander";

import { handleCliError } from "@/core/errors";
import { resolveRepository } from "@/core/repo";
import { validateField } from "@/core/validation";

import { brand, pc } from "@/ui/colors";
import { formatScore } from "@/ui/formatters";
import { withTaskSpinner } from "@/ui/spinner";
import { createTable } from "@/ui/table";

import { getCurrentGitBranch } from "../docs/docs.command";
import {
  formatStatus,
  renderAnalysisTable,
  renderDetailedMetricsTable,
  renderRepoConfigTable,
  renderSearchResultsTable,
  renderStructureMap,
} from "./analyze.formatter";
import { analyzeService } from "./analyze.service";
import { type AnalysisHistoryItem } from "./analyze.types";

export function registerAnalyzeCommand(program: Command) {
  const analyze = program
    .command("analyze")
    .description("Trigger and monitor repository AST security and code quality analysis");

  analyze
    .command("start [target]")
    .description("Trigger cloud AST code verification (e.g. dxnx analyze start owner/repo)")
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

        const result = await withTaskSpinner(
          {
            start: `Dispatching pipeline job for ${repoContext.target}...`,
            stop: "Analysis job dispatched to cloud!",
          },
          () =>
            analyzeService.analyze({
              docTypes: ["README", "ARCHITECTURE", "CODE_DOC"],
              files: [],
              language: options?.language ?? "English",
              repoId: repoContext.repo.id,
            }),
        );

        p.note(
          `Job ID:       ${brand.highlight(result.jobId)}\n` +
            `Status:       ${brand.info(result.status)}\n\n` +
            `To check progress, run:\n` +
            brand.highlight(`dxnx analyze status ${repoContext.target}`),
          "Pipeline Dispatched",
        );

        p.outro(brand.success("🚀 Scanner & AI Engine have started code verification."));
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

        const analysis = await withTaskSpinner(
          {
            silent: options?.json,
            start: `Fetching analysis status for ${repoContext.target}...`,
            stop: "Status retrieved",
          },
          () => analyzeService.getLatest(repoContext.repo.id),
        );

        if (options?.json) {
          console.log(JSON.stringify(analysis, null, 2));
          return;
        }

        if (!analysis) {
          p.outro(
            brand.warning(`No analysis runs found for ${repoContext.target}.\nRun with: `) +
              brand.highlight(`dxnx analyze start ${repoContext.target}`),
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
    .command("cancel [analysisId]")
    .description("Abort an in-flight analysis job (supports Short-ID prefix and interactive pick)")
    .option("-r, --repo <target>", "Target repository (owner/name)")
    .action(async (analysisIdArg?: string, options?: { repo?: string }) => {
      try {
        p.intro(brand.warning(" 🛑 Abort Repository Analysis "));

        let targetId = analysisIdArg?.trim();

        if (!targetId || targetId.length < 32) {
          const repoContext = await resolveRepository(
            options?.repo,
            "Select repository to abort active analysis for:",
          );
          if (!repoContext) {
            return;
          }

          const history = await withTaskSpinner("Fetching active analysis runs...", () =>
            analyzeService.getHistory(repoContext.repo.id),
          );
          const activeRuns = history.filter((h: AnalysisHistoryItem) => h.status === "PENDING");

          if (activeRuns.length === 0) {
            p.outro(
              brand.muted(`No active in-flight analysis runs found for ${repoContext.target}.`),
            );
            return;
          }

          if (targetId) {
            const prefix = targetId.toLowerCase();
            const match = activeRuns.find((r: AnalysisHistoryItem) =>
              r.id.toLowerCase().startsWith(prefix),
            );
            if (!match) {
              p.outro(brand.error(`No active run found matching prefix: '${targetId}'`));
              return;
            }
            targetId = match.id;
          } else {
            const selection = await p.select({
              message: "Select in-flight run to cancel:",
              options: activeRuns.map((r: AnalysisHistoryItem) => ({
                label: `Run ${r.id.slice(0, 8)} (${r.status}) - ${new Date(r.createdAt).toLocaleTimeString()}`,
                value: r.id,
              })),
            });

            if (p.isCancel(selection) || typeof selection !== "string") {
              p.cancel("Abortion cancelled.");
              return;
            }
            targetId = selection;
          }
        }

        const confirmed = await p.confirm({
          message: `Are you sure you want to cancel analysis ${brand.highlight(targetId.slice(0, 8))}?`,
        });

        if (!confirmed || p.isCancel(confirmed)) {
          p.cancel("Abortion cancelled.");
          return;
        }

        await withTaskSpinner(
          {
            start: "Terminating cloud analysis run...",
            stop: "Analysis job cancelled",
          },
          () => analyzeService.cancel(targetId),
        );

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

        const history = await withTaskSpinner(
          {
            silent: options?.json,
            start: `Loading history for ${repoContext.target}...`,
            stop: "History loaded",
          },
          () => analyzeService.getHistory(repoContext.repo.id),
        );

        if (options?.json) {
          console.log(JSON.stringify(history, null, 2));
          return;
        }

        if (history.length === 0) {
          p.outro(brand.muted(`No previous analysis runs found for ${repoContext.target}.`));
          return;
        }

        const table = createTable(["Run ID", "Status", "Date", "Score", "Commit"]);
        for (const run of history) {
          table.push([
            brand.muted(`${run.id.slice(0, 8)}...`),
            formatStatus(run.status),
            new Date(run.createdAt).toLocaleDateString(),
            formatScore(run.score),
            brand.info(run.commitSha ? run.commitSha.slice(0, 7) : "default"),
          ]);
        }

        console.log(`\n  📜 Run History: ${brand.highlight(repoContext.target)}\n`);
        console.log(table.toString());
        console.log("\n");
        p.outro(brand.muted(`Total runs: ${history.length}`));
      } catch (error) {
        handleCliError(error);
      }
    });

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
            if (p.isCancel(inputContent) || !inputContent) {
              p.cancel("Cancelled.");
              return;
            }
            content = inputContent;
          }

          const branch = options.branch ?? getCurrentGitBranch();

          const result = await withTaskSpinner(
            {
              silent: options.json,
              start: `Auditing ${pc.cyan(filePath)} via AST & Security Engine...`,
              stop: "File audit complete!",
            },
            () =>
              analyzeService.quickFileAudit({
                branch,
                content,
                path: filePath,
                repoId: repoContext.repo.id,
              }),
          );

          if (options.json) {
            console.log(JSON.stringify(result, null, 2));
            return;
          }

          const report = typeof result === "string" ? result : JSON.stringify(result, null, 2);

          console.log(`\n${brand.info(`=== Audit Report: ${filePath} ===`)}\n`);
          console.log(report);
          console.log(`\n${brand.info("=== End of Audit Report ===")}\n`);

          p.outro(brand.success("✔ File audit finished!"));
        } catch (error) {
          handleCliError(error);
        }
      },
    );

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

        const config = await withTaskSpinner(
          {
            silent: options?.json,
            start: `Fetching PR config for ${repoContext.target}...`,
            stop: "Config loaded",
          },
          () => analyzeService.getRepoConfig(repoContext.repo.id),
        );

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
          validate: (v) => validateField(UpdatePRConfigInput.shape.tokenBudget)(Number(v)),
        });
        if (p.isCancel(tokenBudgetInput) || !tokenBudgetInput) {
          return p.cancel("Aborted.");
        }

        await withTaskSpinner(
          {
            start: "Saving repository configuration...",
            stop: "Configuration applied!",
          },
          () =>
            analyzeService.configureRepository({
              ciSkip: Boolean(ciSkip),
              commentStyle,
              enabled: Boolean(enabled),
              repoId: repoContext.repo.id,
              tokenBudget: Number(tokenBudgetInput),
            }),
        );

        p.outro(
          brand.success(
            `✔ PR Analysis settings updated for ${brand.highlight(repoContext.target)}!`,
          ),
        );
      } catch (error) {
        handleCliError(error);
      }
    });

  analyze
    .command("metrics [target]")
    .description("Inspect deep AST complexity, technical debt, and code quality metrics")
    .option("-a, --aid <analysisId>", "Specific analysis run ID")
    .option("-r, --repo <target>", "Target repository (owner/name)")
    .option("--json", "Output raw JSON metrics")
    .action(async (target?: string, options?: { aid?: string; json?: boolean; repo?: string }) => {
      try {
        const repoContext = await resolveRepository(
          options?.repo ?? target,
          "Select repository to inspect detailed metrics:",
        );
        if (!repoContext) {
          return;
        }

        const metrics = await withTaskSpinner(
          {
            silent: options?.json,
            start: `Fetching AST metrics for ${pc.cyan(repoContext.target)}...`,
            stop: "Metrics loaded",
          },
          () =>
            analyzeService.getDetailedMetrics({
              aid: options?.aid,
              repoId: repoContext.repo.id,
            }),
        );

        if (options?.json) {
          console.log(JSON.stringify(metrics, null, 2));
          return;
        }

        console.log(
          `\n${brand.logo(` 📊 Detailed AST & Quality Metrics [${repoContext.target}]:\n`)}`,
        );
        console.log(renderDetailedMetricsTable(metrics));
        console.log("\n");

        p.outro(brand.success("✔ Metrics inspection complete!"));
      } catch (error) {
        handleCliError(error);
      }
    });

  analyze
    .command("structure [target]")
    .alias("map")
    .description("Explore project architecture modules, dependency nodes, and structural map")
    .option("-a, --aid <analysisId>", "Specific analysis run ID")
    .option("-r, --repo <target>", "Target repository (owner/name)")
    .option("--json", "Output structure in JSON format")
    .action(async (target?: string, options?: { aid?: string; json?: boolean; repo?: string }) => {
      try {
        const repoContext = await resolveRepository(
          options?.repo ?? target,
          "Select repository to inspect structure:",
        );
        if (!repoContext) {
          return;
        }

        const structure = await withTaskSpinner(
          {
            silent: options?.json,
            start: `Fetching architecture map for ${pc.cyan(repoContext.target)}...`,
            stop: "Architecture map retrieved",
          },
          () =>
            analyzeService.getStructureMap({
              aid: options?.aid,
              repoId: repoContext.repo.id,
            }),
        );

        if (options?.json) {
          console.log(JSON.stringify(structure, null, 2));
          return;
        }

        console.log(
          `\n${brand.logo(` 🏛️ Repository Architecture & Structural Map [${repoContext.target}]:\n`)}`,
        );
        console.log(renderStructureMap(structure));
        console.log("\n");

        p.outro(brand.success("✔ Structural inspection ready."));
      } catch (error) {
        handleCliError(error);
      }
    });

  analyze
    .command("search <query> [target]")
    .description("Search through workspace symbols, modules, and code entities")
    .option("-a, --aid <analysisId>", "Specific analysis run ID")
    .option("-r, --repo <target>", "Target repository (owner/name)")
    .option("--json", "Output matches in JSON format")
    .action(
      async (
        query: string,
        target?: string,
        options?: { aid?: string; json?: boolean; repo?: string },
      ) => {
        try {
          const repoContext = await resolveRepository(
            options?.repo ?? target,
            "Select repository context for search:",
          );
          if (!repoContext) {
            return;
          }

          const results = await withTaskSpinner(
            {
              silent: options?.json,
              start: `Searching workspace for '${pc.cyan(query)}' in ${repoContext.target}...`,
              stop: "Search complete",
            },
            () =>
              analyzeService.searchWorkspace({
                aid: options?.aid,
                repoId: repoContext.repo.id,
                search: query,
              }),
          );

          if (options?.json) {
            console.log(JSON.stringify(results, null, 2));
            return;
          }

          console.log(
            `\n${brand.logo(` 🔎 Workspace Search Results for '${query}' [${repoContext.target}]:\n`)}`,
          );
          console.log(renderSearchResultsTable(results));
          console.log("\n");

          p.outro(brand.success("✔ Search finished."));
        } catch (error) {
          handleCliError(error);
        }
      },
    );
}
