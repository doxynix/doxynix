import * as p from "@clack/prompts";
import type { Command } from "commander";

import { trpc } from "@/core/client";
import { handleCliError } from "@/core/errors";
import { parseRepoTarget } from "@/core/repo";

import { brand, pc } from "@/ui/colors";

import { renderBranchesTable, renderFileTree, renderGithubReposTable } from "./github.formatter";
import { githubService } from "./github.service";

export function registerGithubCommand(program: Command) {
  const gh = program
    .command("github")
    .alias("gh")
    .description("GitHub App integration, remote repository exploration, and branch inspection");

  // 1. dxnx github repos
  gh.command("repos", { isDefault: true })
    .description(
      "List accessible repositories from connected GitHub App and optionally connect them",
    )
    .option("--json", "Output repositories list in JSON format")
    .action(async (options: { json?: boolean }) => {
      try {
        const s = p.spinner();
        if (!options.json) {
          s.start("Fetching repositories from GitHub App...");
        }

        const repos = await githubService.getMyRepos();
        if (!options.json) {
          s.stop("GitHub repositories loaded");
        }

        if (options.json) {
          console.log(JSON.stringify(repos, null, 2));
          return;
        }

        if (!repos || repos.length === 0) {
          p.outro(
            brand.warning("⚠️ No repositories detected from your GitHub App installation.\n") +
              brand.muted("Install or configure the GitHub App using: ") +
              brand.highlight("dxnx github install"),
          );
          return;
        }

        console.log(`\n${brand.logo(" 🐙 Your Accessible GitHub Repositories:\n")}`);
        console.log(renderGithubReposTable(repos));
        console.log("\n");

        const wantConnect = await p.confirm({
          initialValue: false,
          message: "Would you like to connect one of these repositories to Doxynix now?",
        });

        if (wantConnect && !p.isCancel(wantConnect)) {
          const selection = await p.select({
            message: "Select repository to connect:",
            options: repos.map((r: any) => {
              const full = r.fullName ?? `${r.owner}/${r.name}`;
              return {
                label: full,
                value: r.html_url ?? r.url ?? `https://github.com/${full}`,
              };
            }),
          });

          if (!p.isCancel(selection) && typeof selection === "string") {
            const addSpinner = p.spinner();
            addSpinner.start(`Connecting ${selection} to Doxynix...`);
            const res = await githubService.connectRepo(selection);
            addSpinner.stop("Connected successfully!");

            p.outro(
              brand.success(
                `✔ Repository ${brand.highlight(`${res.repo.owner}/${res.repo.name}`)} is connected and ready for analysis!`,
              ),
            );
            return;
          }
        }

        p.outro(brand.muted(`Found ${repos.length} GitHub repositories.`));
      } catch (error) {
        handleCliError(error);
      }
    });

  // 2. dxnx github install
  gh.command("install")
    .description("Get GitHub App installation URL to link organizations or repositories")
    .action(async () => {
      try {
        p.intro(brand.logo(" 🐙 Connect GitHub App "));

        const s = p.spinner();
        s.start("Generating authorization URL...");
        const installUrl = await githubService.getInstallUrl();
        s.stop("URL ready");

        if (!installUrl) {
          p.outro(brand.error("Could not retrieve GitHub App installation URL."));
          return;
        }

        p.note(
          `Open the link below in your browser to grant Doxynix access to your GitHub repositories:\n\n` +
            `${brand.highlight(installUrl)}\n\n` +
            brand.muted(
              "Once installed, run 'dxnx github repos' to see your connected repositories.",
            ),
          "GitHub App Authorization",
        );

        p.outro(brand.success("Link generated successfully!"));
      } catch (error) {
        handleCliError(error);
      }
    });

  // 3. dxnx github branches <target>
  gh.command("branches <target>")
    .description("List all remote branches of a repository (e.g. dxnx github branches owner/repo)")
    .option("--json", "Output branches in JSON format")
    .action(async (target: string, options: { json?: boolean }) => {
      try {
        const parsed = parseRepoTarget(target);
        if (!parsed) {
          p.outro(brand.error("Format must be: owner/name (e.g. facebook/react)"));
          return;
        }

        const s = p.spinner();
        if (!options.json) {
          s.start(`Fetching branches for ${target}...`);
        }

        const branches = await githubService.getBranches(parsed.owner, parsed.name);
        if (!options.json) {
          s.stop("Branches loaded");
        }

        if (options.json) {
          console.log(JSON.stringify(branches, null, 2));
          return;
        }

        if (!branches || branches.length === 0) {
          p.outro(brand.muted(`No branches found for ${target}.`));
          return;
        }

        console.log(`\n  🌿 Branches for ${brand.highlight(target)}:\n`);
        console.log(renderBranchesTable(branches));
        console.log("\n");
        p.outro(brand.muted(`Total branches: ${branches.length}`));
      } catch (error) {
        handleCliError(error);
      }
    });

  // 4. dxnx github tree <target> [branch]
  gh.command("tree <target> [branch]")
    .description(
      "Explore remote repository file tree without cloning (e.g. dxnx github tree owner/repo)",
    )
    .option("--json", "Output file tree in JSON format")
    .action(async (target: string, branch?: string, options?: { json?: boolean }) => {
      try {
        const parsed = parseRepoTarget(target);
        if (!parsed) {
          p.outro(brand.error("Format must be: owner/name (e.g. facebook/react)"));
          return;
        }

        const s = p.spinner();
        if (!options?.json) {
          s.start(`Loading remote files for ${target}...`);
        }

        const files = await githubService.getRepoFiles(parsed.owner, parsed.name, branch);
        if (!options?.json) {
          s.stop("File tree retrieved");
        }

        if (options?.json) {
          console.log(JSON.stringify(files, null, 2));
          return;
        }

        console.log(
          `\n  🗂️ File Tree: ${brand.highlight(target)} ${branch ? pc.cyan(`(${branch})`) : ""}\n`,
        );
        console.log(renderFileTree(files));
        console.log("\n");
        p.outro(brand.muted(`Found ${files.length} items.`));
      } catch (error) {
        handleCliError(error);
      }
    });

  // 5. dxnx github cat <target> <filePath>
  gh.command("cat <target> <filePath>")
    .description("Inspect file contents from a remote GitHub repository")
    .option("-b, --branch <branch>", "Specific branch to fetch from")
    .action(async (target: string, filePath: string, options: { branch?: string }) => {
      try {
        const parsed = parseRepoTarget(target);
        if (!parsed) {
          p.outro(brand.error("Format must be: owner/name (e.g. facebook/react)"));
          return;
        }

        const s = p.spinner();
        s.start("Fetching repository reference...");
        const repo = await trpc.repo.getByName.query({ name: parsed.name, owner: parsed.owner });
        if (!repo) {
          s.stop("Repo not found");
          p.outro(brand.error(`Repository ${target} is not connected in Doxynix yet.`));
          return;
        }

        s.message(`Reading file ${filePath}...`);
        const content = await githubService.getFileContent(repo.id, filePath, options.branch);
        s.stop("File retrieved");

        console.log(`\n${brand.info(`--- ${filePath} (${options.branch ?? "default"}) ---`)}\n`);
        if (typeof content === "string") {
          console.log(content);
        } else if (content?.content) {
          console.log(content.content);
        } else {
          console.log(JSON.stringify(content, null, 2));
        }
        console.log(`\n${brand.info("--- End of file ---")}\n`);
      } catch (error) {
        handleCliError(error);
      }
    });

  // 6. dxnx github search <query>
  gh.command("search <query>")
    .description("Search GitHub repositories directly from terminal")
    .option("--json", "Output search results in JSON format")
    .action(async (query: string, options: { json?: boolean }) => {
      try {
        const s = p.spinner();
        if (!options.json) {
          s.start(`Searching GitHub for '${query}'...`);
        }

        const results = await githubService.searchGithub(query);
        if (!options.json) {
          s.stop("Search complete");
        }

        if (options.json) {
          console.log(JSON.stringify(results, null, 2));
          return;
        }

        const items = Array.isArray(results) ? results : (results.items ?? []);
        if (items.length === 0) {
          p.outro(brand.muted(`No GitHub repositories found matching '${query}'.`));
          return;
        }

        console.log(`\n  🔎 Search Results for ${brand.highlight(query)}:\n`);
        console.log(renderGithubReposTable(items));
        console.log("\n");
        p.outro(brand.muted(`Found ${items.length} matching repositories.`));
      } catch (error) {
        handleCliError(error);
      }
    });
}
