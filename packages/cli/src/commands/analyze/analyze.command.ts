import * as p from "@clack/prompts";
import { UpdatePRConfigInput } from "@doxynix/shared";
import type { Command } from "commander";

import { readFileOrPrompt } from "@/core/fs";
import { getCurrentGitBranch } from "@/core/git";
import { confirmOrAbort, guardPrompt, resolveEntityOrPick } from "@/core/prompts";
import { resolveRepository } from "@/core/repo";
import { validateField } from "@/core/validation";

import { brand, pc } from "@/ui/colors";
import { formatDateTime, formatRelativeTime, formatScore } from "@/ui/formatters";
import { renderBlock, renderCard, renderSection } from "@/ui/layout";
import { output } from "@/ui/output";
import { withTaskSpinner } from "@/ui/spinner";
import { createTable } from "@/ui/table";

import {
  formatStatus,
  renderAnalysisTable,
  renderDetailedMetricsTable,
  renderRepoConfigTable,
  renderSearchResultsTable,
  renderStructureMap,
} from "./analyze.formatter";
import { analyzeService } from "./analyze.service";
import type { AnalysisHistoryItem } from "./analyze.types";

export function registerAnalyzeCommand(program: Command) {
  const analyze = program
    .command("analyze")
    .description("Trigger and monitor repository AST security and code quality analysis");

  analyze
    .command("start [target]")
    .description("Trigger cloud AST code verification (e.g. dxnx analyze start owner/repo)")
    .option("-b, --branch <branch>", "Target Git branch name")
    .option("-l, --language <lang>", "Documentation language (English, Russian)", "English")
    .action(async (target?: string, options?: { branch?: string; language?: string }) => {
      p.intro(brand.logo("Trigger Doxynix Analysis "));
      const branch = options?.branch ?? getCurrentGitBranch();

      const repoContext = await resolveRepository(target, "Select repository to run analysis on:");
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
            branch,
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

      p.outro(brand.success("Scanner & AI Engine have started code verification."));
    });

  analyze
    .command("status [target]")
    .description("Check current status and security scores for repository")
    .option("--json", "Output in JSON format")
    .action(async (target?: string, options?: { json?: boolean }) => {
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

      if (output.json(analysis, options?.json)) {
        return;
      }

      if (!analysis) {
        p.outro(
          brand.warning(`No analysis runs found for ${repoContext.target}.\nRun with: `) +
            brand.highlight(`dxnx analyze start ${repoContext.target}`),
        );
        return;
      }

      console.log(
        renderCard(`Repository Analysis: ${brand.highlight(repoContext.target)}`, [
          ["Status", formatStatus(analysis.status)],
          ["Progress", brand.highlight(`${analysis.progress}%`)],
          ["Info", analysis.message ? brand.muted(analysis.message) : undefined],
        ]),
      );

      console.log(renderSection(brand.logo("Analysis Scores:"), renderAnalysisTable(analysis)));
      p.outro(brand.muted(`Last updated: ${formatDateTime(analysis.updatedAt)}`));
    });

  analyze
    .command("cancel [analysisId]")
    .description("Abort an in-flight analysis job (supports Short-ID prefix and interactive pick)")
    .option("-r, --repo <target>", "Target repository (owner/name)")
    .action(async (analysisIdArg?: string, options?: { repo?: string }) => {
      p.intro(brand.warning("Abort Repository Analysis "));

      let targetId = analysisIdArg?.trim();

      if (!targetId || targetId.length < 32) {
        const repoContext = await resolveRepository(
          options?.repo,
          "Select repository to abort active analysis for:",
        );
        if (!repoContext) {
          return;
        }

        const resolved = await resolveEntityOrPick({
          cancelMessage: "Abortion cancelled.",
          emptyMessage: `No active in-flight analysis runs found for ${repoContext.target}.`,
          fetchItems: async () => {
            const history = await withTaskSpinner("Fetching active analysis runs...", () =>
              analyzeService.getHistory(repoContext.repo.id),
            );
            return history.filter((h: AnalysisHistoryItem) => h.status === "PENDING");
          },
          getLabel: (r: AnalysisHistoryItem) =>
            `Run ${r.id.slice(0, 8)} (${r.status}) - ${formatRelativeTime(r.createdAt)}`,
          idArg: targetId,
          notFoundMessage: (target) => `No active run found matching prefix: '${target}'`,
          selectMessage: "Select in-flight run to cancel:",
        });

        if (!resolved) {
          return;
        }
        targetId = resolved;
      }

      const confirmed = await confirmOrAbort({
        cancelMessage: "Abortion cancelled.",
        message: `Are you sure you want to cancel analysis ${brand.highlight(targetId.slice(0, 8))}?`,
      });

      if (!confirmed) {
        return;
      }

      await withTaskSpinner(
        {
          start: "Terminating cloud analysis run...",
          stop: "Analysis job cancelled",
        },
        () => analyzeService.cancel(targetId),
      );

      p.outro(brand.success("Analysis pipeline has been successfully terminated."));
    });

  analyze
    .command("history [target]")
    .description("View the history of all analysis runs for a repository")
    .option("--json", "Output history in JSON format")
    .action(async (target?: string, options?: { json?: boolean }) => {
      const repoContext = await resolveRepository(target, "Select repository to view run history:");
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

      if (output.json(history, options?.json)) {
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
          brand.muted(formatRelativeTime(run.createdAt)),
          formatScore(run.score),
          brand.info(run.commitSha ? run.commitSha.slice(0, 7) : "default"),
        ]);
      }

      console.log(
        renderSection(brand.logo(`Run History: ${brand.highlight(repoContext.target)}`), table),
      );
      p.outro(brand.muted(`Total runs: ${history.length}`));
    });

  analyze
    .command("audit <filePath>")
    .description("Run a fast on-demand AI security and code-quality audit for a single file")
    .option("-r, --repo <target>", "Repository context (owner/name)")
    .option("-b, --branch <branch>", "Git branch name")
    .option("--json", "Output raw JSON result")
    .action(
      async (filePath: string, options: { branch?: string; json?: boolean; repo?: string }) => {
        p.intro(brand.logo("Single-File Security Audit "));

        const repoContext = await resolveRepository(
          options.repo,
          "Select repository context for this file audit:",
        );
        if (!repoContext) {
          return;
        }

        const content = await readFileOrPrompt(filePath);
        if (!content) {
          return;
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

        if (output.json(result, options.json)) {
          return;
        }

        const report = JSON.stringify(result, null, 2);
        console.log(renderBlock(`Audit Report: ${filePath}`, report));

        p.outro(brand.success("File audit finished!"));
      },
    );

  analyze
    .command("config [target]")
    .description("View repository PR analysis configuration and security policies")
    .option("--json", "Output config in JSON format")
    .action(async (target?: string, options?: { json?: boolean }) => {
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

      if (output.json(config, options?.json)) {
        return;
      }

      console.log(
        renderSection(
          brand.logo(`Pull Request Analysis Settings: ${repoContext.target}`),
          renderRepoConfigTable(config ?? {}),
        ),
      );
      p.outro(brand.muted(`Update settings with: dxnx analyze config-set ${repoContext.target}`));
    });

  analyze
    .command("config-set [target]")
    .description("Interactively update repository PR automation and security settings")
    .action(async (target?: string) => {
      p.intro(brand.logo("Configure PR Automation "));

      const repoContext = await resolveRepository(target, "Select repository to configure:");
      if (!repoContext) {
        return;
      }

      const currentConfig = (await analyzeService.getRepoConfig(repoContext.repo.id)) ?? {};

      const enabled = await guardPrompt(
        p.confirm({
          initialValue: currentConfig.enabled ?? true,
          message: "Enable automated Pull Request reviews on GitHub?",
        }),
        "Configuration aborted.",
      );

      const commentStyle = await guardPrompt(
        p.select({
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
        }),
      );

      const ciSkip = await guardPrompt(
        p.confirm({
          initialValue: currentConfig.ciSkip ?? false,
          message: "Allow skipping PR analysis using [skip ci] in commit message?",
        }),
      );

      const tokenBudgetInput = await guardPrompt(
        p.text({
          defaultValue: String(currentConfig.tokenBudget ?? 50_000),
          message: "Max AI Token Budget per Pull Request run (10000 - 100000):",
          validate: (v) => validateField(UpdatePRConfigInput.shape.tokenBudget)(Number(v)),
        }),
      );

      await withTaskSpinner(
        {
          start: "Saving repository configuration...",
          stop: "Configuration applied!",
        },
        () =>
          analyzeService.configureRepository({
            ciSkip: Boolean(ciSkip),
            commentStyle: commentStyle as "CONCISE" | "DETAILED" | "OFF",
            enabled: Boolean(enabled),
            repoId: repoContext.repo.id,
            tokenBudget: Number(tokenBudgetInput),
          }),
      );

      p.outro(
        brand.success(`PR Analysis settings updated for ${brand.highlight(repoContext.target)}!`),
      );
    });

  analyze
    .command("metrics [target]")
    .description("Inspect deep AST complexity, technical debt, and code quality metrics")
    .option("-a, --aid <analysisId>", "Specific analysis run ID")
    .option("-r, --repo <target>", "Target repository (owner/name)")
    .option("--json", "Output raw JSON metrics")
    .action(async (target?: string, options?: { aid?: string; json?: boolean; repo?: string }) => {
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

      if (output.json(metrics, options?.json)) {
        return;
      }

      console.log(
        renderSection(
          brand.logo(`Detailed AST & Quality Metrics [${repoContext.target}]:`),
          renderDetailedMetricsTable(metrics),
        ),
      );
      p.outro(brand.success("Metrics inspection complete!"));
    });

  analyze
    .command("structure [target]")
    .alias("map")
    .description("Explore project architecture modules, dependency nodes, and structural map")
    .option("-a, --aid <analysisId>", "Specific analysis run ID")
    .option("-r, --repo <target>", "Target repository (owner/name)")
    .option("--json", "Output structure in JSON format")
    .action(async (target?: string, options?: { aid?: string; json?: boolean; repo?: string }) => {
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

      if (output.json(structure, options?.json)) {
        return;
      }

      console.log(
        renderSection(
          brand.logo(`Repository Architecture & Structural Map [${repoContext.target}]:`),
          renderStructureMap(structure),
        ),
      );
      p.outro(brand.success("Structural inspection ready."));
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

        if (output.json(results, options?.json)) {
          return;
        }

        console.log(
          renderSection(
            brand.logo(`Workspace Search Results for '${query}' [${repoContext.target}]:`),
            renderSearchResultsTable(results),
          ),
        );
        p.outro(brand.success("Search finished."));
      },
    );
}
