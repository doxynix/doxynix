import * as p from "@clack/prompts";
import { CreatePrSchema } from "@doxynix/shared";
import type { Command } from "commander";

import { readLocalFileIfExists } from "@/core/fs";
import { guardPrompt, resolveEntityOrPick } from "@/core/prompts";
import { resolveRepository } from "@/core/repo";
import { validateField } from "@/core/validation";

import { brand, pc } from "@/ui/colors";
import { formatDateTime } from "@/ui/formatters";
import { renderCard, renderSection } from "@/ui/layout";
import { output } from "@/ui/output";
import { withTaskSpinner } from "@/ui/spinner";

import {
  renderFixesTable,
  renderPRAnalysisDetails,
  renderPRCommentsTable,
  renderPRImpactDetails,
  renderPRListTable,
} from "./pr.formatter";
import { prService } from "./pr.service";
import type {
  CreateFixInput,
  FindingForFix,
  FixDetails,
  FixItem,
  PRListItem,
  StagedFixedFile,
} from "./pr.types";

async function resolveFixId(repoId: string, fixIdArg?: string): Promise<string | null> {
  return resolveEntityOrPick({
    cancelMessage: "Selection cancelled.",
    emptyMessage: "No AI-generated fixes found for this repository.",
    fetchItems: () =>
      withTaskSpinner("Loading AI-generated fixes...", () => prService.getFixes(repoId)),
    getLabel: (f: FixItem) =>
      `${f.title ?? "AI Suggested Fix"} [${f.status}] (${f.id.slice(0, 8)})`,
    idArg: fixIdArg,
    notFoundMessage: (prefix) => `No fix found matching prefix: '${prefix}'`,
    selectMessage: "Select an AI Code Fix:",
  });
}

export function registerPrCommand(program: Command) {
  const pr = program
    .command("pr")
    .alias("pull-request")
    .description(
      "Inspect GitHub Pull Request analyses, post review comments, and manage AI code fixes",
    );

  pr.command("list [target]", { isDefault: true })
    .description("List Pull Request reviews and security risk scores for a repository")
    .option("--json", "Output in JSON format")
    .action(async (target?: string, options?: { json?: boolean }) => {
      const repoContext = await resolveRepository(target, "Select repository for Pull Requests:");
      if (!repoContext) {
        return;
      }

      const prList = await withTaskSpinner(
        {
          silent: options?.json,
          start: `Fetching PR analyses for ${repoContext.target}...`,
          stop: "PR analyses loaded",
        },
        () => prService.listByRepository(repoContext.repo.id),
      );

      if (output.json(prList, options?.json)) {
        return;
      }

      if (prList.length === 0) {
        p.outro(brand.muted(`No Pull Request analyses recorded yet for ${repoContext.target}.`));
        return;
      }

      console.log(
        renderSection(
          brand.logo(`Pull Request Security Reviews: ${repoContext.target}`),
          renderPRListTable(prList),
        ),
      );
      p.outro(brand.muted(`Total analyzed pull requests: ${prList.length}`));
    });

  pr.command("fix [fixId]")
    .alias("fix-view")
    .description(
      "Inspect details and generated file patches (supports Short ID and interactive select)",
    )
    .option("-r, --repo <target>", "Target repository (owner/name)")
    .option("--json", "Output fix in JSON format")
    .action(async (fixIdArg?: string, options?: { json?: boolean; repo?: string }) => {
      const repoContext = await resolveRepository(options?.repo);
      if (!repoContext) {
        return;
      }

      const fixId = await resolveFixId(repoContext.repo.id, fixIdArg);
      if (!fixId) {
        return;
      }

      const fix = await withTaskSpinner(
        {
          silent: options?.json,
          start: `Fetching fix details for ${brand.highlight(fixId.slice(0, 8))}...`,
          stop: "Fix details loaded",
        },
        () => prService.getFixById(fixId),
      );

      if (output.json(fix, options?.json)) {
        return;
      }

      console.log(
        renderCard(`Fix Details: ${brand.highlight(fix.title ?? "AI Code Fix")}`, [
          ["ID", brand.muted(fix.id)],
          ["Status", brand.info(fix.status)],
          ["Branch", pc.cyan(fix.branch ?? "—")],
          ["Created", brand.muted(formatDateTime(fix.createdAt))],
          ["PR URL", fix.githubPrUrl ? brand.highlight(fix.githubPrUrl) : undefined],
        ]),
      );

      const result = fix.resultJson;
      if (result != null && "fixedFiles" in result && Array.isArray(result.fixedFiles)) {
        const files = result.fixedFiles as StagedFixedFile[];
        const patchList = files.map((f) => `  ${pc.gray("•")} ${pc.cyan(f.filePath)}`).join("\n");

        console.log(
          renderSection(brand.logo(`Generated Patches (${files.length} file(s)):`), patchList),
        );
      }

      p.outro(
        brand.muted("To apply this fix, run: ") +
          brand.highlight(`dxnx pr fix-apply ${fix.id.slice(0, 8)}`),
      );
    });

  pr.command("fix-apply [fixId]")
    .alias("apply-fix")
    .description("Apply an AI-generated fix directly by opening a GitHub Pull Request")
    .option("-r, --repo <target>", "Target repository (owner/name)")
    .option("-b, --branch <branch>", "Target branch name to create")
    .option("-t, --title <title>", "Pull Request title")
    .action(
      async (fixIdArg?: string, options?: { branch?: string; repo?: string; title?: string }) => {
        p.intro(brand.logo("Apply AI Fix to GitHub "));

        const repoContext = await resolveRepository(options?.repo);
        if (!repoContext) {
          return;
        }

        const fixId = await resolveFixId(repoContext.repo.id, fixIdArg);
        if (!fixId) {
          return;
        }

        const fix: FixDetails = await withTaskSpinner(
          {
            start: "Fetching fix data and patches...",
            stop: "Fix data verified",
          },
          () => prService.getFixById(fixId),
        );

        const data = fix.resultJson;
        const fixedFiles: StagedFixedFile[] =
          data != null && "fixedFiles" in data && Array.isArray(data.fixedFiles)
            ? (data.fixedFiles as StagedFixedFile[])
            : [];

        if (fixedFiles.length === 0) {
          p.outro(
            brand.error(
              `Fix ${fix.id.slice(0, 8)} does not have ready patches (Status: ${fix.status}). Wait for completion.`,
            ),
          );
          return;
        }

        const branch =
          options?.branch ?? fix.branch ?? `dxnx-fix-${Date.now().toString().slice(-4)}`;
        const title = options?.title ?? fix.title ?? "fix: AI suggested improvements";

        const result = await withTaskSpinner(
          {
            start: `Pushing ${fixedFiles.length} file(s) and creating GitHub Pull Request...`,
            stop: "PR created!",
          },
          () =>
            prService.applyFix({
              branch,
              fixedFiles,
              fixId: fix.id,
              repoId: repoContext.repo.id,
              title,
            }),
        );

        if (!result.success) {
          p.outro(brand.error(`Failed to apply fix: ${result.error ?? "Unknown error"}`));
          return;
        }

        p.note(
          `Title:   ${brand.highlight(title)}\n` +
            `Branch:  ${pc.cyan(branch)}\n` +
            `PR #:    ${brand.info(String(result.prNumber ?? "N/A"))}\n` +
            `URL:     ${brand.highlight(result.prUrl ?? "Live on GitHub")}`,
          "GitHub Pull Request Live",
        );

        p.outro(brand.success("AI fix successfully applied and PR opened on GitHub!"));
      },
    );

  pr.command("fix-create [target]")
    .alias("fix-generate")
    .description("Generate an AI-suggested code fix for detected issues ('Fix it for me')")
    .option("-f, --file <filePath>", "Path of the file needing a fix")
    .option("-l, --line <number>", "Line number of the vulnerability/issue", "1")
    .option("-m, --message <issue>", "Description of the vulnerability or finding to fix")
    .option("--findings-file <file>", "Path to JSON file containing array of findings")
    .option("-p, --pr-analysis-id <analysisId>", "Associated PR analysis ID")
    .action(
      async (
        target?: string,
        options?: {
          file?: string;
          findingsFile?: string;
          line?: string;
          message?: string;
          prAnalysisId?: string;
        },
      ) => {
        p.intro(brand.logo("AI Automated Fix Generator "));

        const repoContext = await resolveRepository(
          target,
          "Select repository to generate fix for:",
        );
        if (!repoContext) {
          return;
        }

        let findings: FindingForFix[] = [];

        if (options?.findingsFile) {
          const raw = readLocalFileIfExists(options.findingsFile);
          if (!raw) {
            p.outro(brand.error(`Findings file '${options.findingsFile}' not found.`));
            return;
          }

          try {
            const parsed: unknown = JSON.parse(raw);
            if (!Array.isArray(parsed)) {
              p.outro(
                brand.error(
                  `Findings file '${options.findingsFile}' must contain a JSON array of findings.`,
                ),
              );
              return;
            }
            findings = parsed as FindingForFix[];
          } catch (parseError) {
            const errorMsg = parseError instanceof Error ? parseError.message : String(parseError);
            p.outro(
              brand.error(`Invalid JSON in findings file '${options.findingsFile}': ${errorMsg}`),
            );
            return;
          }
        } else {
          let filePath = options?.file;
          if (!filePath) {
            const filePrompt = await guardPrompt(
              p.text({
                message: "Enter the relative path of the file to fix:",
                placeholder: "src/server/auth.ts",
                validate: (v) => (!v?.trim() ? "File path is required" : undefined),
              }),
              "Aborted.",
            );
            filePath = filePrompt.trim();
          }

          let message = options?.message;
          if (!message) {
            const msgPrompt = await guardPrompt(
              p.text({
                message: "Describe the issue/vulnerability to fix:",
                placeholder: "Sanitize SQL input to prevent injection",
                validate: (v) => (!v?.trim() ? "Description is required" : undefined),
              }),
              "Aborted.",
            );
            message = msgPrompt.trim();
          }

          const line = Number(options?.line) || 1;
          findings = [
            {
              file: filePath,
              line,
              suggestion: message,
              type: "CODE_SMELL",
            },
          ];
        }

        const fileContents: Record<string, string> = {};
        for (const f of findings) {
          const fileText = readLocalFileIfExists(f.file);
          if (fileText !== null) {
            fileContents[f.file] = fileText;
          }
        }

        const payload: CreateFixInput = {
          fileContents,
          findings,
          prAnalysisId: options?.prAnalysisId,
          repoId: repoContext.repo.id,
        };

        const result = await withTaskSpinner(
          {
            start: `Dispatching AI fix generator for ${pc.cyan(repoContext.target)}...`,
            stop: "Fix generation dispatched!",
          },
          () => prService.createFix(payload),
        );

        if (!result.success || !result.fixId) {
          p.outro(brand.error(`Fix generation failed: ${result.error ?? "Unknown error"}`));
          return;
        }

        p.note(
          `Fix ID:    ${brand.highlight(result.fixId)}\n` +
            `Status:    ${brand.info(result.status ?? "PENDING")}\n` +
            `Target:    ${pc.cyan(repoContext.target)}\n\n` +
            `To check generated patches when ready, run:\n` +
            brand.highlight(`dxnx pr fix ${result.fixId.slice(0, 8)}`),
          "Generation In Progress",
        );

        p.outro(brand.success("Trigger.dev cloud worker is generating code improvements!"));
      },
    );

  pr.command("comments [targetOrAnalysisId] [prNumber]")
    .alias("findings")
    .description("Inspect AI review comments and security findings for a Pull Request")
    .option("-r, --repo <target>", "Repository context (owner/name)")
    .option("--json", "Output comments in JSON format")
    .action(
      async (
        targetOrAnalysisIdArg?: string,
        prNumberArg?: string,
        options?: { json?: boolean; repo?: string },
      ) => {
        let repoTarget = options?.repo;
        let identifier = prNumberArg;

        if (targetOrAnalysisIdArg?.includes("/")) {
          repoTarget = targetOrAnalysisIdArg;
        } else if (targetOrAnalysisIdArg && !identifier) {
          identifier = targetOrAnalysisIdArg;
        }

        let analysisId: string | null = null;

        if (identifier && /^\d+$/.test(identifier)) {
          const repoContext = await resolveRepository(
            repoTarget,
            "Select repository for PR review findings:",
          );
          if (!repoContext) {
            return;
          }

          const rawPrNumber = Number(identifier);
          const prList = await withTaskSpinner("Loading PR list for selection...", () =>
            prService.listByRepository(repoContext.repo.id),
          );

          const foundPR = prList.find((item) => item.prNumber === rawPrNumber);
          if (!foundPR) {
            p.outro(
              brand.warning(`No analysis found for PR #${rawPrNumber} in ${repoContext.target}.`),
            );
            return;
          }

          analysisId = foundPR.id;
        } else if (identifier && identifier.length >= 32 && !identifier.includes("/")) {
          analysisId = identifier;
        } else {
          const repoContext = await resolveRepository(
            repoTarget,
            "Select repository for PR review findings:",
          );
          if (!repoContext) {
            return;
          }

          analysisId = await resolveEntityOrPick({
            cancelMessage: "Inspection cancelled.",
            emptyMessage: `No PR analyses found for ${repoContext.target}.`,
            fetchItems: () =>
              withTaskSpinner("Fetching recent PR analyses for selection...", () =>
                prService.listByRepository(repoContext.repo.id),
              ),
            getLabel: (item: PRListItem) =>
              `PR #${item.prNumber} [${item.status}] — Risk: ${item.riskScore ?? 0}/100 (${item.id.slice(0, 8)})`,
            idArg: identifier,
            notFoundMessage: (prefix) => `No PR analysis found matching prefix: '${prefix}'`,
            selectMessage: "Select a Pull Request analysis to inspect review findings:",
          });

          if (!analysisId) {
            return;
          }
        }

        if (!analysisId) {
          return;
        }
        const targetId = analysisId;

        const result = await withTaskSpinner(
          {
            silent: options?.json,
            start: `Fetching AI review findings for ${brand.highlight(targetId.slice(0, 8))}...`,
            stop: "Comments retrieved",
          },
          () => prService.getComments(targetId),
        );

        if (!result || !Array.isArray(result.renderedComments)) {
          p.outro(brand.error("Could not load comments payload."));
          return;
        }

        if (output.json(result.renderedComments, options?.json)) {
          return;
        }

        const comments = result.renderedComments;
        if (comments.length === 0) {
          p.outro(brand.success("No issues or comments found for this Pull Request!"));
          return;
        }

        console.log(
          renderSection(
            brand.logo(`AI Review Findings & Comments (${comments.length} items):`),
            renderPRCommentsTable(comments),
          ),
        );

        p.outro(
          brand.muted("To auto-fix these findings with AI, run: ") +
            brand.highlight("dxnx pr fix-create"),
        );
      },
    );

  pr.command("open [target]")
    .description("Open a GitHub Pull Request with all currently staged changes via GitHub App")
    .option("-b, --branch <branch>", "Custom branch name for the PR")
    .option("-t, --title <title>", "Pull Request title")
    .action(async (target?: string, options?: { branch?: string; title?: string }) => {
      p.intro(brand.logo("Open Pull Request "));
      const repoContext = await resolveRepository(target);
      if (!repoContext) {
        return;
      }

      let title = options?.title;
      if (!title) {
        const titlePrompt = await guardPrompt(
          p.text({
            defaultValue: "fix: security improvements and optimizations",
            message: "Enter Pull Request title:",
            validate: validateField(CreatePrSchema.shape.prTitle),
          }),
          "PR creation cancelled.",
        );
        title = titlePrompt.trim();
      }

      let branch = options?.branch;
      if (!branch) {
        const defaultBranch = `dxnx-fix-${Date.now().toString().slice(-4)}`;
        const branchPrompt = await guardPrompt(
          p.text({
            defaultValue: defaultBranch,
            message: "Enter target branch name to create:",
            validate: (v) => (!v?.trim() ? "Branch name is required" : undefined),
          }),
          "Cancelled.",
        );
        branch = branchPrompt.trim();
      }

      const result = await withTaskSpinner(
        {
          start: `Applying staged files and opening PR on GitHub (${repoContext.target})...`,
          stop: "Pull Request created!",
        },
        () =>
          prService.openPullRequest({
            branch,
            repoId: repoContext.repo.id,
            title,
          }),
      );

      if (!result.success || !result.prNumber) {
        p.outro(brand.error(`Failed to open Pull Request: ${result.error ?? "Unknown error"}`));
        return;
      }

      p.note(
        `Title:   ${brand.highlight(title)}\n` +
          `Branch:  ${pc.cyan(branch)}\n` +
          `PR #:    ${brand.info(String(result.prNumber ?? "N/A"))}\n` +
          `URL:     ${brand.highlight(result.prUrl ?? "Created successfully")}`,
        "GitHub Pull Request Opened",
      );

      p.outro(brand.success("Changes are now live on GitHub!"));
    });

  pr.command("comment <prNumber> <body> [target]")
    .description("Post an engineering / security comment directly to a GitHub Pull Request")
    .action(async (prNumberStr: string, body: string, target?: string) => {
      const prNumber = Number(prNumberStr);
      if (!Number.isSafeInteger(prNumber) || prNumber <= 0) {
        p.outro(brand.error("PR number must be a valid positive integer."));
        return;
      }

      const repoContext = await resolveRepository(target);
      if (!repoContext) {
        return;
      }

      await withTaskSpinner(
        {
          start: `Posting review comment to PR #${prNumber} on ${repoContext.target}...`,
          stop: "Comment posted successfully!",
        },
        () =>
          prService.postComment({
            body,
            prNumber,
            repoId: repoContext.repo.id,
          }),
      );

      p.outro(brand.success(`Comment published on GitHub Pull Request #${prNumber}.`));
    });

  pr.command("fixes [target]")
    .description("List AI-suggested code fixes generated for this repository")
    .option("--json", "Output fixes in JSON format")
    .action(async (target?: string, options?: { json?: boolean }) => {
      const repoContext = await resolveRepository(target);
      if (!repoContext) {
        return;
      }

      const fixes = await withTaskSpinner(
        {
          silent: options?.json,
          start: `Loading AI fixes for ${repoContext.target}...`,
          stop: "Fixes retrieved",
        },
        () => prService.getFixes(repoContext.repo.id),
      );

      if (output.json(fixes, options?.json)) {
        return;
      }

      if (fixes.length === 0) {
        p.outro(brand.muted(`No generated fixes recorded for ${repoContext.target}.`));
        return;
      }

      console.log(
        renderSection(
          brand.logo(`AI Generated Improvements: ${repoContext.target}`),
          renderFixesTable(fixes),
        ),
      );
      p.outro(
        brand.muted("Inspect details with: ") + brand.highlight("dxnx pr fix <id-or-prefix>"),
      );
    });

  pr.command("view [target] [prNumberOrId]")
    .alias("inspect")
    .description("Inspect detailed PR analysis metadata and security impact")
    .option("-r, --repo <target>", "Target repository (owner/name)")
    .option("--json", "Output response in JSON format")
    .action(
      async (
        targetArg?: string,
        prNumberOrIdArg?: string,
        options?: { json?: boolean; repo?: string },
      ) => {
        let repoTarget = options?.repo;
        let identifier = prNumberOrIdArg;

        if (targetArg?.includes("/")) {
          repoTarget = targetArg;
        } else if (targetArg && !identifier) {
          identifier = targetArg;
        }

        const repoContext = await resolveRepository(
          repoTarget,
          "Select repository to inspect PR analysis:",
        );
        if (!repoContext) {
          return;
        }

        if (identifier && /^\d+$/.test(identifier)) {
          const prNum = Number(identifier);

          const impact = await withTaskSpinner(
            {
              silent: options?.json,
              start: `Fetching impact analysis for PR #${prNum} in ${repoContext.target}...`,
              stop: "Impact data loaded",
            },
            () =>
              prService.getImpactByPRNumber({
                prNumber: prNum,
                repoId: repoContext.repo.id,
              }),
          );

          if (output.json(impact, options?.json)) {
            return;
          }

          if (!impact) {
            p.outro(brand.warning(`No analysis found for PR #${prNum}.`));
            return;
          }

          console.log(
            renderSection(
              brand.logo(`PR #${prNum} Impact & Security Overview [${repoContext.target}]:`),
              renderPRImpactDetails(impact),
            ),
          );

          p.outro(
            brand.muted("Inspect inline code review comments with: ") +
              brand.highlight(`dxnx pr comments ${repoContext.target} ${prNum}`),
          );
          return;
        }

        const analysisId = await resolveEntityOrPick({
          cancelMessage: "Inspection cancelled.",
          emptyMessage: `No PR analyses found for ${repoContext.target}.`,
          fetchItems: () =>
            withTaskSpinner("Fetching recent PR analyses for selection...", () =>
              prService.listByRepository(repoContext.repo.id),
            ),
          getLabel: (item: PRListItem) =>
            `PR #${item.prNumber} [${item.status}] — Risk: ${item.riskScore ?? 0}/100 (${item.id.slice(0, 8)})`,
          idArg: identifier,
          notFoundMessage: (prefix) => `No PR analysis found matching prefix: '${prefix}'`,
          selectMessage: "Select a Pull Request analysis to inspect:",
        });

        if (!analysisId) {
          return;
        }

        const analysis = await withTaskSpinner(
          {
            silent: options?.json,
            start: `Fetching PR analysis ${brand.highlight(analysisId.slice(0, 8))}...`,
            stop: "Analysis loaded",
          },
          () => prService.getAnalysis({ analysisId }),
        );

        if (output.json(analysis, options?.json)) {
          return;
        }

        console.log(
          renderSection(
            brand.logo(`Pull Request Analysis Details [${repoContext.target}]:`),
            renderPRAnalysisDetails(analysis),
          ),
        );

        p.outro(
          brand.muted("Inspect review findings with: ") +
            brand.highlight(`dxnx pr comments ${analysis.publicId}`),
        );
      },
    );
}
