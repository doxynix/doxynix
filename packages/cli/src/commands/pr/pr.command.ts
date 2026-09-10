import fs from "node:fs";
import path from "node:path";

import * as p from "@clack/prompts";
import { CreatePrSchema } from "@doxynix/shared";
import type { Command } from "commander";

import { handleCliError } from "@/core/errors";
import { resolveRepository } from "@/core/repo";
import { validateField } from "@/core/validation";

import { brand, pc } from "@/ui/colors";
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
  if (fixIdArg && fixIdArg.length >= 32) {
    return fixIdArg;
  }

  const fixes = await withTaskSpinner("Loading AI-generated fixes...", () =>
    prService.getFixes(repoId),
  );
  if (fixes.length === 0) {
    p.outro(brand.muted("No AI-generated fixes found for this repository."));
    return null;
  }

  if (fixIdArg) {
    const prefix = fixIdArg.toLowerCase();
    const matched = fixes.find((f: FixItem) => f.id.toLowerCase().startsWith(prefix));
    if (!matched) {
      p.outro(brand.error(`No fix found matching prefix: '${fixIdArg}'`));
      return null;
    }
    return matched.id;
  }

  const selection = await p.select({
    message: "Select an AI Code Fix:",
    options: fixes.map((f: FixItem) => ({
      label: `${f.title ?? "AI Suggested Fix"} [${f.status}] (${f.id.slice(0, 8)})`,
      value: f.id,
    })),
  });

  if (p.isCancel(selection) || typeof selection !== "string") {
    p.cancel("Selection cancelled.");
    return null;
  }

  return selection;
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
      try {
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

        if (options?.json) {
          console.log(JSON.stringify(prList, null, 2));
          return;
        }

        if (prList.length === 0) {
          p.outro(brand.muted(`No Pull Request analyses recorded yet for ${repoContext.target}.`));
          return;
        }

        console.log(
          `\n${brand.logo(` 🔍 Pull Request Security Reviews: ${repoContext.target}\n`)}`,
        );
        console.log(renderPRListTable(prList));
        console.log("\n");
        p.outro(brand.muted(`Total analyzed pull requests: ${prList.length}`));
      } catch (error) {
        handleCliError(error);
      }
    });

  pr.command("fix [fixId]")
    .alias("fix-view")
    .description(
      "Inspect details and generated file patches (supports Short ID and interactive select)",
    )
    .option("-r, --repo <target>", "Target repository (owner/name)")
    .option("--json", "Output fix in JSON format")
    .action(async (fixIdArg?: string, options?: { json?: boolean; repo?: string }) => {
      try {
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

        if (options?.json) {
          console.log(JSON.stringify(fix, null, 2));
          return;
        }

        console.log(`\n  🛠️ Fix Details: ${brand.highlight(fix.title ?? "AI Code Fix")}`);
        console.log(`  ID:          ${brand.muted(fix.id)}`);
        console.log(`  Status:      ${brand.info(fix.status)}`);
        console.log(`  Branch:      ${pc.cyan(fix.branch ?? "—")}`);
        console.log(`  Created:     ${brand.muted(new Date(fix.createdAt).toLocaleString())}`);
        if (fix.githubPrUrl) {
          console.log(`  PR URL:      ${brand.highlight(fix.githubPrUrl)}`);
        }

        const res = fix.resultJson;
        if (res != null && "fixedFiles" in res && Array.isArray(res.fixedFiles)) {
          const files = res.fixedFiles as StagedFixedFile[];
          console.log(`\n  📂 Generated Patches (${files.length} file(s)):`);
          for (const f of files) {
            console.log(`    • ${pc.cyan(f.filePath)}`);
          }
        }
        console.log("\n");

        p.outro(
          brand.muted("To apply this fix, run: ") +
            brand.highlight(`dxnx pr fix-apply ${fix.id.slice(0, 8)}`),
        );
      } catch (error) {
        handleCliError(error);
      }
    });

  pr.command("fix-apply [fixId]")
    .alias("apply-fix")
    .description("Apply an AI-generated fix directly by opening a GitHub Pull Request")
    .option("-r, --repo <target>", "Target repository (owner/name)")
    .option("-b, --branch <branch>", "Target branch name to create")
    .option("-t, --title <title>", "Pull Request title")
    .action(
      async (fixIdArg?: string, options?: { branch?: string; repo?: string; title?: string }) => {
        try {
          p.intro(brand.logo(" 🚀 Apply AI Fix to GitHub "));

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

          const res = fix.resultJson;
          const fixedFiles: StagedFixedFile[] =
            res != null && "fixedFiles" in res && Array.isArray(res.fixedFiles)
              ? (res.fixedFiles as StagedFixedFile[])
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
            p.outro(brand.error(`❌ Failed to apply fix: ${result.error ?? "Unknown error"}`));
            return;
          }

          p.note(
            `Title:   ${brand.highlight(title)}\n` +
              `Branch:  ${pc.cyan(branch)}\n` +
              `PR #:    ${brand.info(String(result.prNumber ?? "N/A"))}\n` +
              `URL:     ${brand.highlight(result.prUrl ?? "Live on GitHub")}`,
            "GitHub Pull Request Live",
          );

          p.outro(brand.success("🎉 AI fix successfully applied and PR opened on GitHub!"));
        } catch (error) {
          handleCliError(error);
        }
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
        try {
          p.intro(brand.logo(" 🛠️ AI Automated Fix Generator "));

          const repoContext = await resolveRepository(
            target,
            "Select repository to generate fix for:",
          );
          if (!repoContext) {
            return;
          }

          let findings: FindingForFix[] = [];

          if (options?.findingsFile) {
            const raw = fs.readFileSync(path.resolve(process.cwd(), options.findingsFile), "utf-8");
            findings = JSON.parse(raw) as FindingForFix[];
          } else {
            let filePath = options?.file;
            if (!filePath) {
              const fileInput = await p.text({
                message: "Enter the relative path of the file to fix:",
                placeholder: "src/server/auth.ts",
                validate: (v) => (!v?.trim() ? "File path is required" : undefined),
              });
              if (p.isCancel(fileInput)) {
                return p.cancel("Aborted.");
              }
              filePath = fileInput.trim();
            }

            let message = options?.message;
            if (!message) {
              const msgInput = await p.text({
                message: "Describe the issue/vulnerability to fix:",
                placeholder: "Sanitize SQL input to prevent injection",
                validate: (v) => (!v?.trim() ? "Description is required" : undefined),
              });
              if (p.isCancel(msgInput)) {
                return p.cancel("Aborted.");
              }
              message = msgInput.trim();
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
            const localFile = path.resolve(process.cwd(), f.file);
            if (fs.existsSync(localFile) && fs.statSync(localFile).isFile()) {
              fileContents[f.file] = fs.readFileSync(localFile, "utf-8");
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
            p.outro(brand.error(`❌ Fix generation failed: ${result.error ?? "Unknown error"}`));
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

          p.outro(brand.success("🚀 Trigger.dev cloud worker is generating code improvements!"));
        } catch (error) {
          handleCliError(error);
        }
      },
    );

  pr.command("comments <targetOrAnalysisId> [prNumber]")
    .alias("findings")
    .description("Inspect AI review comments and security findings for a Pull Request")
    .option("-r, --repo <target>", "Repository context (owner/name)")
    .option("--json", "Output comments in JSON format")
    .action(
      async (
        targetOrAnalysisId: string,
        prNumberArg?: string,
        options?: { json?: boolean; repo?: string },
      ) => {
        try {
          let analysisId = targetOrAnalysisId;

          const isNumeric =
            /^\d+$/.test(targetOrAnalysisId) || (prNumberArg != null && /^\d+$/.test(prNumberArg));

          if (isNumeric) {
            const rawPrNumber = prNumberArg ?? targetOrAnalysisId;
            const repoTarget =
              options?.repo ?? (targetOrAnalysisId.includes("/") ? targetOrAnalysisId : undefined);

            const repoContext = await resolveRepository(
              repoTarget,
              "Select repository for PR review findings:",
            );
            if (!repoContext) {
              return;
            }

            const prs = await withTaskSpinner(
              {
                silent: options?.json,
                start: `Looking up analysis for PR #${rawPrNumber} in ${repoContext.target}...`,
                stop: "PR record located",
              },
              () => prService.listByRepository(repoContext.repo.id),
            );

            const matched = prs.find((item: PRListItem) => item.prNumber === Number(rawPrNumber));

            if (!matched) {
              p.outro(
                brand.warning(`No analysis found for PR #${rawPrNumber} in ${repoContext.target}.`),
              );
              return;
            }

            const analysisRecord = await prService.getByPRNumber({
              prNumber: Number(rawPrNumber),
              repoId: repoContext.repo.id,
            });

            if (!analysisRecord) {
              p.outro(
                brand.warning(`No analysis found for PR #${rawPrNumber} in ${repoContext.target}.`),
              );
              return;
            }

            analysisId = matched.id;
          }

          const result = await withTaskSpinner(
            {
              silent: options?.json,
              start: `Fetching AI review findings for ${brand.highlight(analysisId.slice(0, 8))}...`,
              stop: "Comments retrieved",
            },
            () => prService.getComments(analysisId),
          );

          if (options?.json) {
            console.log(JSON.stringify(result.renderedComments, null, 2));
            return;
          }

          const comments = result.renderedComments;
          if (comments.length === 0) {
            p.outro(brand.success("🎉 No issues or comments found for this Pull Request!"));
            return;
          }

          console.log(
            `\n${brand.logo(` 🔍 AI Review Findings & Comments (${comments.length} items):\n`)}`,
          );
          console.log(renderPRCommentsTable(comments));
          console.log("\n");

          p.outro(
            brand.muted("To auto-fix these findings with AI, run: ") +
              brand.highlight("dxnx pr fix-create"),
          );
        } catch (error) {
          handleCliError(error);
        }
      },
    );

  pr.command("open [target]")
    .description("Open a GitHub Pull Request with all currently staged changes via GitHub App")
    .option("-b, --branch <branch>", "Custom branch name for the PR")
    .option("-t, --title <title>", "Pull Request title")
    .action(async (target?: string, options?: { branch?: string; title?: string }) => {
      try {
        p.intro(brand.logo(" 🚀 Open Pull Request "));
        const repoContext = await resolveRepository(target);
        if (!repoContext) {
          return;
        }

        let title = options?.title;
        if (!title) {
          const titleInput = await p.text({
            defaultValue: "fix: security improvements and optimizations",
            message: "Enter Pull Request title:",
            validate: validateField(CreatePrSchema.shape.prTitle),
          });
          if (p.isCancel(titleInput)) {
            return p.cancel("PR creation cancelled.");
          }
          title = titleInput.trim();
        }

        let branch = options?.branch;
        if (!branch) {
          const defaultBranch = `dxnx-fix-${Date.now().toString().slice(-4)}`;
          const branchInput = await p.text({
            defaultValue: defaultBranch,
            message: "Enter target branch name to create:",
            validate: (v) => (!v?.trim() ? "Branch name is required" : undefined),
          });
          if (p.isCancel(branchInput)) {
            return p.cancel("Cancelled.");
          }
          branch = branchInput.trim();
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

        p.note(
          `Title:   ${brand.highlight(title)}\n` +
            `Branch:  ${pc.cyan(branch)}\n` +
            `PR #:    ${brand.info(String(result.prNumber ?? "N/A"))}\n` +
            `URL:     ${brand.highlight(result.prUrl ?? "Created successfully")}`,
          "GitHub Pull Request Opened",
        );

        p.outro(brand.success("🎉 Changes are now live on GitHub!"));
      } catch (error) {
        handleCliError(error);
      }
    });

  pr.command("comment <prNumber> <body> [target]")
    .description("Post an engineering / security comment directly to a GitHub Pull Request")
    .action(async (prNumberStr: string, body: string, target?: string) => {
      try {
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

        p.outro(brand.success(`✔ Comment published on GitHub Pull Request #${prNumber}.`));
      } catch (error) {
        handleCliError(error);
      }
    });

  pr.command("fixes [target]")
    .description("List AI-suggested code fixes generated for this repository")
    .option("--json", "Output fixes in JSON format")
    .action(async (target?: string, options?: { json?: boolean }) => {
      try {
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

        if (options?.json) {
          console.log(JSON.stringify(fixes, null, 2));
          return;
        }

        if (fixes.length === 0) {
          p.outro(brand.muted(`No generated fixes recorded for ${repoContext.target}.`));
          return;
        }

        console.log(`\n${brand.logo(` 🛠️ AI Generated Improvements: ${repoContext.target}\n`)}`);
        console.log(renderFixesTable(fixes));
        console.log("\n");
        p.outro(
          brand.muted("Inspect details with: ") + brand.highlight("dxnx pr fix <id-or-prefix>"),
        );
      } catch (error) {
        handleCliError(error);
      }
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
        try {
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

          if (!identifier) {
            const prs = await withTaskSpinner("Fetching recent PR analyses for selection...", () =>
              prService.listByRepository(repoContext.repo.id),
            );

            if (prs.length === 0) {
              p.outro(brand.muted(`No PR analyses found for ${repoContext.target}.`));
              return;
            }

            const selection = await p.select({
              message: "Select a Pull Request analysis to inspect:",
              options: prs.map((item: PRListItem) => ({
                label: `PR #${item.prNumber} [${item.status}] — Risk: ${item.riskScore ?? 0}/100 (${item.id.slice(0, 8)})`,
                value: String(item.prNumber),
              })),
            });

            if (p.isCancel(selection) || typeof selection !== "string") {
              p.cancel("Inspection cancelled.");
              return;
            }
            identifier = selection;
          }

          if (/^\d+$/.test(identifier)) {
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

            if (options?.json) {
              console.log(JSON.stringify(impact, null, 2));
              return;
            }

            if (!impact) {
              p.outro(brand.warning(`No analysis found for PR #${prNum}.`));
              return;
            }

            console.log(
              `\n${brand.logo(` 🔍 PR #${prNum} Impact & Security Overview [${repoContext.target}]:\n`)}`,
            );
            console.log(renderPRImpactDetails(impact));
            console.log("\n");

            p.outro(
              brand.muted("Inspect inline code review comments with: ") +
                brand.highlight(`dxnx pr comments ${repoContext.target} ${prNum}`),
            );
            return;
          }

          let analysisId = identifier;
          if (analysisId.length < 32) {
            const prs = await withTaskSpinner("Resolving Short-ID prefix...", () =>
              prService.listByRepository(repoContext.repo.id),
            );

            const prefix = analysisId.toLowerCase();
            const matched = prs.find((item: PRListItem) =>
              item.id.toLowerCase().startsWith(prefix),
            );
            if (!matched) {
              p.outro(brand.error(`No PR analysis found matching prefix: '${analysisId}'`));
              return;
            }
            analysisId = matched.id;
          }

          const analysis = await withTaskSpinner(
            {
              silent: options?.json,
              start: `Fetching PR analysis ${brand.highlight(analysisId.slice(0, 8))}...`,
              stop: "Analysis loaded",
            },
            () => prService.getAnalysis({ analysisId }),
          );

          if (options?.json) {
            console.log(JSON.stringify(analysis, null, 2));
            return;
          }

          console.log(
            `\n${brand.logo(` 🔍 Pull Request Analysis Details [${repoContext.target}]:\n`)}`,
          );
          console.log(renderPRAnalysisDetails(analysis));
          console.log("\n");

          p.outro(
            brand.muted("Inspect review findings with: ") +
              brand.highlight(`dxnx pr comments ${analysis.publicId}`),
          );
        } catch (error) {
          handleCliError(error);
        }
      },
    );
}
