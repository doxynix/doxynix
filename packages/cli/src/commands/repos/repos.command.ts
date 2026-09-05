import * as p from "@clack/prompts";
import type { Command } from "commander";

import { handleCliError } from "@/core/errors";

import { brand } from "@/ui/colors";

import { renderRepoDetails, renderReposTable } from "./repos.formatter";
import { reposService } from "./repos.service";

export function registerReposCommand(program: Command) {
  const repos = program.command("repos").description("Manage connected Doxynix repositories");

  repos
    .command("list", { isDefault: true })
    .description("List all connected repositories")
    .option("-l, --limit <number>", "Number of repositories to return", "20")
    .option("-s, --search <query>", "Search repositories by name")
    .option("-o, --owner <owner>", "Filter repositories by owner / organization")
    .option("--json", "Output response in JSON format")
    .action(async (options: { limit: string; search?: string; owner?: string; json?: boolean }) => {
      try {
        const s = p.spinner();
        if (!options.json) {
          s.start("Fetching repositories...");
        }

        const data = await reposService.list(
          Number(options.limit) || 20,
          options.search,
          options.owner,
        );
        if (!options.json) {
          s.stop("Repositories loaded");
        }

        if (options.json) {
          console.log(JSON.stringify(data, null, 2));
          return;
        }

        if (data.items.length === 0) {
          p.outro(
            brand.muted("No repositories found.\n") +
              brand.muted("Connect a new repository with: ") +
              brand.highlight("dxnx repos add <github-url>"),
          );
          return;
        }

        console.log(`\n${renderReposTable(data.items)}\n`);
        p.outro(
          brand.muted(`Showing ${data.items.length} of ${data.meta.totalCount} repositories`),
        );
      } catch (error) {
        handleCliError(error);
      }
    });

  repos
    .command("add <url>")
    .description(
      "Connect a new GitHub repository (e.g. dxnx repos add https://github.com/facebook/react)",
    )
    .action(async (url: string) => {
      try {
        p.intro(brand.logo(" ➕ Connect Repository "));

        const s = p.spinner();
        s.start(`Connecting repository from ${url}...`);

        const res = await reposService.add(url);
        s.stop("Repository connected successfully!");

        p.note(
          `Target:      ${brand.highlight(`${res.repo.owner}/${res.repo.name}`)}\n` +
            `Language:    ${res.repo.language ?? "Unknown"}\n` +
            `ID:          ${brand.muted(res.repo.id)}`,
          "Repository Connected",
        );

        p.outro(brand.success("✨ Repository is ready for security analysis!"));
      } catch (error) {
        handleCliError(error);
      }
    });

  repos
    .command("view <target>")
    .description("View repository summary and metadata (e.g. dxnx repos view owner/name)")
    .option("--json", "Output response in JSON format")
    .action(async (target: string, options: { json?: boolean }) => {
      try {
        const [owner, name] = target.split("/");
        if (!owner || !name) {
          p.outro(brand.error("Invalid format. Use: owner/name (e.g. doxynix/core)"));
          return;
        }

        const s = p.spinner();
        if (!options.json) {
          s.start(`Fetching details for ${target}...`);
        }

        const repo = await reposService.getByName(owner, name);
        if (!options.json) {
          s.stop("Details retrieved");
        }

        if (options.json) {
          console.log(JSON.stringify(repo, null, 2));
          return;
        }

        if (!repo) {
          p.outro(brand.error(`Repository ${target} was not found.`));
          return;
        }

        renderRepoDetails(repo);
      } catch (error) {
        handleCliError(error);
      }
    });

  repos
    .command("delete <id>")
    .description("Delete a repository from Doxynix by its UUID")
    .action(async (id: string) => {
      try {
        p.intro(brand.error(" ⚠️ Remove Repository "));

        const isConfirmed = await p.confirm({
          message: `Are you sure you want to delete repository ${brand.highlight(id)}?`,
        });

        if (!isConfirmed || p.isCancel(isConfirmed)) {
          p.outro(brand.muted("Action cancelled."));
          return;
        }

        const s = p.spinner();
        s.start("Removing repository...");
        const res = await reposService.delete(id);
        s.stop("Repository removed successfully");

        p.outro(brand.success(`👋 ${res.message}`));
      } catch (error) {
        handleCliError(error);
      }
    });
  // dxnx repos purge-owner <owner>
  repos
    .command("purge-owner <owner>")
    .description("Delete all repositories associated with a specific owner or organization")
    .action(async (owner: string) => {
      try {
        p.intro(brand.warning(` 🗑️ Purge Repositories for '${owner}' `));

        const isConfirmed = await p.confirm({
          message: `Are you SURE you want to delete ALL repositories belonging to ${brand.highlight(owner)}?`,
        });

        if (!isConfirmed || p.isCancel(isConfirmed)) {
          p.outro(brand.muted("Purge cancelled."));
          return;
        }

        const s = p.spinner();
        s.start(`Deleting repositories for ${owner}...`);
        const res = await reposService.deleteByOwner(owner);
        s.stop("Purge completed");

        p.outro(brand.success(`✔ ${res.message} (${res.count} repositories removed)`));
      } catch (error) {
        handleCliError(error);
      }
    });

  // dxnx repos purge-all
  repos
    .command("purge-all")
    .description("Danger: Remove ALL connected repositories from your account")
    .action(async () => {
      try {
        p.intro(brand.error(" ⚠️ Danger: Purge All Repositories "));

        const isConfirmed = await p.confirm({
          active: "Yes, delete all",
          inactive: "Abort",
          message: brand.error(
            "This will permanently remove EVERY connected repository and its analyses. Proceed?",
          ),
        });

        if (!isConfirmed || p.isCancel(isConfirmed)) {
          p.outro(brand.muted("Purge cancelled."));
          return;
        }

        const s = p.spinner();
        s.start("Removing all repositories...");
        const res = await reposService.deleteAll();
        s.stop("Repositories cleared");

        p.outro(brand.success(`✔ ${res.message}`));
      } catch (error) {
        handleCliError(error);
      }
    });
}
