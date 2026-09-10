import * as p from "@clack/prompts";
import type { Command } from "commander";

import { handleCliError } from "@/core/errors";
import { parseRepoTarget } from "@/core/repo";

import { brand, pc } from "@/ui/colors";
import { withTaskSpinner } from "@/ui/spinner";

import { reposService } from "../repos/repos.service";
import { renderBranchesTable, renderFileTree, renderGithubReposTable } from "./github.formatter";
import { githubService } from "./github.service";

export function registerGithubCommand(program: Command) {
  const gh = program
    .command("github")
    .alias("gh")
    .description("GitHub App integration, remote repository exploration, and branch inspection");

  gh.command("repos", { isDefault: true })
    .description(
      "List accessible repositories from connected GitHub App and optionally connect them",
    )
    .option("--json", "Output repositories list in JSON format")
    .action(async (options: { json?: boolean }) => {
      try {
        const data = await withTaskSpinner(
          {
            silent: options.json,
            start: "Fetching repositories from GitHub App...",
            stop: "GitHub repositories loaded",
          },
          () => githubService.getMyRepos(),
        );
        const repos = data.items;

        if (options.json) {
          console.log(JSON.stringify(data, null, 2));
          return;
        }

        if (repos.length === 0) {
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
            options: repos.map((r) => {
              const full = r.fullName;
              return {
                label: full,
                value: `https://github.com/${full}`,
              };
            }),
          });

          if (!p.isCancel(selection) && typeof selection === "string") {
            const res = await withTaskSpinner(
              {
                start: `Connecting ${selection} to Doxynix...`,
                stop: "Connected successfully!",
              },
              () => githubService.connectRepo(selection),
            );

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

  gh.command("install")
    .description("Get GitHub App installation URL to link organizations or repositories")
    .action(async () => {
      try {
        p.intro(brand.logo(" 🐙 Connect GitHub App "));

        const installUrl = await withTaskSpinner(
          {
            start: "Generating authorization URL...",
            stop: "URL ready",
          },
          () => githubService.getInstallUrl(),
        );

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

        const branches = await withTaskSpinner(
          {
            silent: options.json,
            start: `Fetching branches for ${target}...`,
            stop: "Branches loaded",
          },
          () => githubService.getBranches(parsed.owner, parsed.name),
        );

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

        const files = await withTaskSpinner(
          {
            silent: options?.json,
            start: `Loading remote files for ${target}...`,
            stop: "File tree retrieved",
          },
          () => githubService.getRepoFiles(parsed.owner, parsed.name, branch),
        );

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

        const repo = await withTaskSpinner("Fetching repository reference...", () =>
          reposService.getByName(parsed.owner, parsed.name),
        );

        if (!repo) {
          p.outro(brand.error(`Repository ${target} is not connected in Doxynix yet.`));
          return;
        }

        const result = await withTaskSpinner(`Reading file ${filePath}...`, () =>
          githubService.getFileContent(repo.id, filePath, options.branch),
        );

        console.log(`\n${brand.info(`--- ${filePath} (${options.branch ?? "default"}) ---`)}\n`);
        console.log(result.content);
        console.log(`\n${brand.info("--- End of file ---")}\n`);
      } catch (error) {
        handleCliError(error);
      }
    });

  gh.command("search <query>")
    .description("Search GitHub repositories directly from terminal")
    .option("--json", "Output search results in JSON format")
    .action(async (query: string, options: { json?: boolean }) => {
      try {
        const results = await withTaskSpinner(
          {
            silent: options.json,
            start: `Searching GitHub for '${query}'...`,
            stop: "Search complete",
          },
          () => githubService.searchGithub(query),
        );

        if (options.json) {
          console.log(JSON.stringify(results, null, 2));
          return;
        }

        if (results.length === 0) {
          p.outro(brand.muted(`No GitHub repositories found matching '${query}'.`));
          return;
        }

        console.log(`\n  🔎 Search Results for ${brand.highlight(query)}:\n`);
        console.log(renderGithubReposTable(results));
        console.log("\n");
        p.outro(brand.muted(`Found ${results.length} matching repositories.`));
      } catch (error) {
        handleCliError(error);
      }
    });
}
