import * as p from "@clack/prompts";
import { type Command } from "commander";

import { handleCliError } from "@/core/errors";

import { brand } from "@/ui/colors";
import { withTaskSpinner } from "@/ui/spinner";

import { renderRepoDetails, renderReposTable, renderSlimReposTable } from "./repos.formatter";
import { reposService } from "./repos.service";
import { type RepoListItem } from "./repos.types";

export function registerReposCommand(program: Command) {
  const repos = program.command("repos").description("Manage connected Doxynix repositories");

  repos
    .command("list", { isDefault: true })
    .description("List all connected repositories")
    .option("-l, --limit <number>", "Number of repositories to return", "20")
    .option("-s, --search <query>", "Search repositories by name")
    .option("-o, --owner <owner>", "Filter repositories by owner / organization")
    .option("--json", "Output response in JSON format")
    .action(async (options: { json?: boolean; limit: string; owner?: string; search?: string }) => {
      try {
        const data = await withTaskSpinner(
          {
            silent: options.json,
            start: "Fetching repositories...",
            stop: "Repositories loaded",
          },
          () =>
            reposService.list({
              limit: Number(options.limit) || 20,
              owner: options.owner,
              search: options.search,
            }),
        );

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

        const res = await withTaskSpinner(
          {
            start: `Connecting repository from ${url}...`,
            stop: "Repository connected successfully!",
          },
          () => reposService.add(url),
        );

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

        const repo = await withTaskSpinner(
          {
            silent: options.json,
            start: `Fetching details for ${target}...`,
            stop: "Details retrieved",
          },
          () => reposService.getByName(owner, name),
        );

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
    .command("delete [id]")
    .description("Delete repository (supports Short-ID prefix and interactive pick)")
    .action(async (id?: string) => {
      try {
        p.intro(brand.error(" ⚠️ Remove Repository "));

        let targetId = id?.trim();

        if (!targetId || targetId.length < 32) {
          const list = await withTaskSpinner("Fetching repositories for resolution...", () =>
            reposService.list({ limit: 50 }),
          );

          if (list.items.length === 0) {
            p.outro(brand.muted("No connected repositories found."));
            return;
          }

          if (targetId) {
            const prefix = targetId.toLowerCase();
            const matched = list.items.find(
              (r: RepoListItem) =>
                r.id.toLowerCase().startsWith(prefix) ||
                `${r.owner}/${r.name}`.toLowerCase() === prefix,
            );
            if (!matched) {
              p.outro(brand.error(`No repository matching '${targetId}'.`));
              return;
            }
            targetId = matched.id;
          } else {
            const selection = await p.select({
              message: "Select repository to delete:",
              options: list.items.map((r: RepoListItem) => ({
                label: `${r.owner}/${r.name} (${r.id.slice(0, 8)})`,
                value: r.id,
              })),
            });

            if (p.isCancel(selection) || typeof selection !== "string") {
              p.cancel("Deletion cancelled.");
              return;
            }
            targetId = selection;
          }
        }

        const isConfirmed = await p.confirm({
          message: `Are you sure you want to delete repository ${brand.highlight(targetId.slice(0, 8))}?`,
        });

        if (!isConfirmed || p.isCancel(isConfirmed)) {
          p.outro(brand.muted("Action cancelled."));
          return;
        }

        const res = await withTaskSpinner(
          {
            start: "Removing repository...",
            stop: "Repository removed successfully",
          },
          () => reposService.delete(targetId),
        );

        p.outro(brand.success(`👋 ${res.message}`));
      } catch (error) {
        handleCliError(error);
      }
    });

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

        const res = await withTaskSpinner(
          {
            start: `Deleting repositories for ${owner}...`,
            stop: "Purge completed",
          },
          () => reposService.deleteByOwner(owner),
        );

        p.outro(brand.success(`✔ ${res.message} (${res.count} repositories removed)`));
      } catch (error) {
        handleCliError(error);
      }
    });

  repos
    .command("owner <owner>")
    .description("Inspect primary repository belonging to an owner or GitHub organization")
    .option("--json", "Output response in JSON format")
    .action(async (owner: string, options: { json?: boolean }) => {
      try {
        const repo = await withTaskSpinner(
          {
            silent: options.json,
            start: `Fetching repository owned by ${owner}...`,
            stop: "Repository retrieved",
          },
          () => reposService.getByOwner(owner),
        );

        if (options.json) {
          console.log(JSON.stringify(repo, null, 2));
          return;
        }

        if (!repo) {
          p.outro(brand.muted(`No repository found for owner '${owner}'.`));
          return;
        }

        renderRepoDetails(repo);
      } catch (error) {
        handleCliError(error);
      }
    });

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

        const res = await withTaskSpinner(
          {
            start: "Removing all repositories...",
            stop: "Repositories cleared",
          },
          () => reposService.deleteAll(),
        );

        p.outro(brand.success(`✔ ${res.message}`));
      } catch (error) {
        handleCliError(error);
      }
    });

  repos
    .command("slim")
    .alias("quick")
    .description("Lightweight list of repositories (optimized for scripts and fast lookups)")
    .option("-l, --limit <number>", "Number of repositories to return", "50")
    .option("-s, --search <query>", "Filter repositories by name")
    .option("-o, --owner <owner>", "Filter repositories by owner / organization")
    .option("-c, --cursor <page>", "Pagination page number", "1")
    .option("--json", "Output response in JSON format")
    .action(
      async (options: {
        cursor?: string;
        json?: boolean;
        limit?: string;
        owner?: string;
        search?: string;
      }) => {
        try {
          const res = await withTaskSpinner(
            {
              silent: options.json,
              start: "Fetching quick repositories list...",
              stop: "Repositories loaded",
            },
            () =>
              reposService.getSlim({
                cursor: options.cursor ? Number(options.cursor) : 1,
                limit: options.limit ? Number(options.limit) : 50,
                owner: options.owner,
                search: options.search,
              }),
          );

          if (options.json) {
            console.log(JSON.stringify(res, null, 2));
            return;
          }

          if (res.items.length === 0) {
            p.outro(brand.muted("No repositories matched your query."));
            return;
          }

          console.log(`\n${brand.logo(" ⚡ Connected Repositories (Slim View):\n")}`);
          console.log(renderSlimReposTable(res.items));
          console.log("\n");
          p.outro(brand.muted(`Found ${res.items.length} of ${res.meta.totalCount} repositories.`));
        } catch (error) {
          handleCliError(error);
        }
      },
    );
}
