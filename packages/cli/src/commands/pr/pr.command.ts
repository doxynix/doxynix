import * as p from "@clack/prompts";
import type { Command } from "commander";

import { trpc } from "@/core/client";
import { handleCliError } from "@/core/errors";

import { brand, pc } from "@/ui/colors";

import { renderFixesTable, renderPRListTable } from "./pr.formatter";
import { prService } from "./pr.service";

async function resolveRepo(target?: string) {
  let repoTarget = target;
  if (!repoTarget) {
    const res = await trpc.repo.getAll.query({ limit: 50, sortBy: "createdAt", sortOrder: "desc" });
    if (res.items.length === 0) {
      p.outro(
        brand.muted("Connect a repository first: ") + brand.highlight("dxnx repos add <url>"),
      );
      return null;
    }
    const selection = await p.select({
      message: "Select repository for Pull Request operations:",
      options: res.items.map((r) => ({
        label: `${r.owner}/${r.name}`,
        value: `${r.owner}/${r.name}`,
      })),
    });
    if (p.isCancel(selection) || typeof selection !== "string") {
      p.cancel("Cancelled.");
      return null;
    }
    repoTarget = selection;
  }

  const [owner, name] = repoTarget.split("/");
  const repo = await trpc.repo.getByName.query({ name: name!, owner: owner! });
  if (!repo) {
    p.outro(brand.error(`Repository ${repoTarget} not found.`));
    return null;
  }
  return { repo, target: repoTarget };
}

export function registerPrCommand(program: Command) {
  const pr = program
    .command("pr")
    .alias("pull-request")
    .description(
      "Inspect GitHub Pull Request analyses, post review comments, and open PRs from staged fixes",
    );

  // 1. dxnx pr list [target]
  pr.command("list [target]", { isDefault: true })
    .description("List Pull Request reviews and security risk scores for a repository")
    .option("--json", "Output in JSON format")
    .action(async (target?: string, options?: { json?: boolean }) => {
      try {
        const repoContext = await resolveRepo(target);
        if (!repoContext) {
          return;
        }

        const s = p.spinner();
        if (!options?.json) {
          s.start(`Fetching PR analyses for ${repoContext.target}...`);
        }
        const prList = await prService.listByRepository(repoContext.repo.id);
        if (!options?.json) {
          s.stop("PR analyses loaded");
        }

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

  // 2. dxnx pr open [target]
  pr.command("open [target]")
    .description("Open a GitHub Pull Request with all currently staged changes via GitHub App")
    .option("-b, --branch <branch>", "Custom branch name for the PR")
    .option("-t, --title <title>", "Pull Request title")
    .action(async (target?: string, options?: { branch?: string; title?: string }) => {
      try {
        p.intro(brand.logo(" 🚀 Open Pull Request "));
        const repoContext = await resolveRepo(target);
        if (!repoContext) {
          return;
        }

        let title = options?.title;
        if (!title) {
          const titleInput = await p.text({
            defaultValue: "fix: security improvements and optimizations",
            message: "Enter Pull Request title:",
            validate: (v) => (!v?.trim() ? "Title cannot be empty" : undefined),
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

        const s = p.spinner();
        s.start(`Applying staged files and opening PR on GitHub (${repoContext.target})...`);
        const result = await prService.openPullRequest(repoContext.repo.id, title, branch);
        s.stop("Pull Request created!");

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

  // 3. dxnx pr comment <prNumber> <body> [target]
  pr.command("comment <prNumber> <body> [target]")
    .description("Post an engineering / security comment directly to a GitHub Pull Request")
    .action(async (prNumberStr: string, body: string, target?: string) => {
      try {
        const prNumber = Number(prNumberStr);
        if (Number.isNaN(prNumber) || prNumber <= 0) {
          p.outro(brand.error("PR number must be a valid positive integer."));
          return;
        }

        const repoContext = await resolveRepo(target);
        if (!repoContext) {
          return;
        }

        const s = p.spinner();
        s.start(`Posting review comment to PR #${prNumber} on ${repoContext.target}...`);
        await prService.postComment(repoContext.repo.id, prNumber, body);
        s.stop("Comment posted successfully!");

        p.outro(brand.success(`✔ Comment published on GitHub Pull Request #${prNumber}.`));
      } catch (error) {
        handleCliError(error);
      }
    });

  // 4. dxnx pr fixes [target]
  pr.command("fixes [target]")
    .description("List AI-suggested code fixes generated for this repository")
    .option("--json", "Output fixes in JSON format")
    .action(async (target?: string, options?: { json?: boolean }) => {
      try {
        const repoContext = await resolveRepo(target);
        if (!repoContext) {
          return;
        }

        const s = p.spinner();
        if (!options?.json) {
          s.start(`Loading AI fixes for ${repoContext.target}...`);
        }
        const fixes = await prService.getFixes(repoContext.repo.id);
        if (!options?.json) {
          s.stop("Fixes retrieved");
        }

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
        p.outro(brand.muted(`Total fixes: ${fixes.length}`));
      } catch (error) {
        handleCliError(error);
      }
    });
}
