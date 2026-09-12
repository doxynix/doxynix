import * as p from "@clack/prompts";
import type { Command } from "commander";

import { confirmOrAbort, resolveEntityOrPick } from "@/core/prompts";

import { brand } from "@/ui/colors";
import { renderSection } from "@/ui/layout";
import { output } from "@/ui/output";
import { withTaskSpinner } from "@/ui/spinner";

import { renderRepoDetails, renderReposTable, renderSlimReposTable } from "./repos.formatter";
import { reposService } from "./repos.service";
import type { RepoListItem } from "./repos.types";

export function registerReposCommand(program: Command) {
  const repos = program.command("repos").description("Manage connected Doxynix repositories");

  repos
    .command("list", { isDefault: true })
    .description("List connected repositories with pagination support")
    .option("-l, --limit <number>", "Number of repositories to return per page", "20")
    .option("-c, --cursor <page>", "Page number", "1")
    .option("-s, --search <query>", "Search repositories by name (server-side)")
    .option("-o, --owner <owner>", "Filter repositories by owner / organization")
    .option("--json", "Output response in JSON format")
    .action(
      async (options: {
        cursor?: string;
        json?: boolean;
        limit: string;
        owner?: string;
        search?: string;
      }) => {
        const parsedLimit = Number(options.limit);
        const limit =
          Number.isFinite(parsedLimit) && parsedLimit > 0 ? Math.min(100, parsedLimit) : 20;
        const parsedCursor = Number(options.cursor);
        const cursor = Number.isFinite(parsedCursor) && parsedCursor > 0 ? parsedCursor : 1;

        const result = await withTaskSpinner(
          {
            silent: options.json,
            start: `Fetching repositories (page ${cursor})...`,
            stop: "Repositories loaded",
          },
          () =>
            reposService.list({
              cursor,
              limit,
              owner: options.owner,
              search: options.search,
            }),
        );

        if (output.json(result, options.json)) {
          return;
        }

        if (result.items.length === 0) {
          p.outro(
            brand.muted("No repositories found.\n") +
              brand.muted("Connect a new repository with: ") +
              brand.highlight("dxnx repos add <github-url>"),
          );
          return;
        }

        console.log(
          renderSection(brand.logo("Connected Repositories:"), renderReposTable(result.items)),
        );

        const total = result.meta?.totalCount ?? result.items.length;
        const totalPages = Math.ceil(total / limit);
        const hasNextPage = cursor < totalPages;

        let footer = brand.muted(
          `Showing page ${cursor} of ${totalPages} (${result.items.length} of ${total} total).`,
        );
        if (hasNextPage) {
          const nextArgs = [`-c ${cursor + 1}`, `-l ${limit}`];
          if (options.owner) {
            nextArgs.push(`-o ${options.owner}`);
          }
          if (options.search) {
            nextArgs.push(`-s "${options.search}"`);
          }
          footer +=
            brand.muted("\nNext page: ") + brand.highlight(`dxnx repos list ${nextArgs.join(" ")}`);
        }

        p.outro(footer);
      },
    );

  repos
    .command("add <url>")
    .description(
      "Connect a new GitHub repository (e.g. dxnx repos add https://github.com/facebook/react)",
    )
    .action(async (url: string) => {
      p.intro(brand.logo("Connect Repository "));

      const result = await withTaskSpinner(
        {
          start: `Connecting repository from ${url}...`,
          stop: "Repository connected successfully!",
        },
        () => reposService.add(url),
      );

      p.note(
        `Target:      ${brand.highlight(`${result.repo.owner}/${result.repo.name}`)}\n` +
          `Language:    ${result.repo.language ?? "Unknown"}\n` +
          `ID:          ${brand.muted(result.repo.id)}`,
        "Repository Connected",
      );

      p.outro(brand.success("Repository is ready for security analysis!"));
    });

  repos
    .command("view <target>")
    .description("View repository summary and metadata (e.g. dxnx repos view owner/name)")
    .option("--json", "Output response in JSON format")
    .action(async (target: string, options: { json?: boolean }) => {
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

      if (!repo) {
        if (options.json) {
          output.json({ error: `Repository ${target} was not found`, success: false }, true);
          return;
        }
        p.outro(brand.error(`Repository ${target} was not found.`));
        return;
      }

      if (output.json(repo, options.json)) {
        return;
      }

      renderRepoDetails(repo);
    });

  repos
    .command("delete [id]")
    .description("Delete repository (supports Short-ID prefix and interactive pick)")
    .action(async (id?: string) => {
      p.intro(brand.error("Remove Repository "));

      const targetId = await resolveEntityOrPick({
        cancelMessage: "Deletion cancelled.",
        emptyMessage: "No connected repositories found.",
        fetchItems: async () => {
          const list = await reposService.list({ cursor: 1, limit: 25 });
          return list.items;
        },
        getLabel: (r: RepoListItem) => `${r.owner}/${r.name} (${r.id.slice(0, 8)})`,
        idArg: id,
        matcher: (r: RepoListItem, query) =>
          r.id.toLowerCase().startsWith(query) || `${r.owner}/${r.name}`.toLowerCase() === query,
        notFoundMessage: (target) => `No repository matching '${target}'.`,
        selectMessage: "Select repository to delete:",
      });

      if (!targetId) {
        return;
      }

      const confirmed = await confirmOrAbort({
        danger: true,
        message: `Are you sure you want to delete repository ${brand.highlight(targetId.slice(0, 8))}?`,
      });

      if (!confirmed) {
        return;
      }

      const result = await withTaskSpinner(
        {
          start: "Removing repository...",
          stop: "Repository removed successfully",
        },
        () => reposService.delete(targetId),
      );

      p.outro(brand.success(result.message));
    });

  repos
    .command("purge-owner <owner>")
    .description("Delete all repositories associated with a specific owner or organization")
    .action(async (owner: string) => {
      p.intro(brand.warning(`Purge Repositories for '${owner}' `));

      const confirmed = await confirmOrAbort({
        active: "Yes, delete all",
        cancelMessage: "Purge cancelled.",
        danger: true,
        inactive: "Abort",
        message: `Are you SURE you want to delete ALL repositories belonging to ${brand.highlight(owner)}?`,
      });

      if (!confirmed) {
        return;
      }

      const result = await withTaskSpinner(
        {
          start: `Deleting repositories for ${owner}...`,
          stop: "Purge completed",
        },
        () => reposService.deleteByOwner(owner),
      );

      p.outro(brand.success(`${result.message} (${result.count} repositories removed)`));
    });

  repos
    .command("owner <owner>")
    .description("Inspect primary repository belonging to an owner or GitHub organization")
    .option("--json", "Output response in JSON format")
    .action(async (owner: string, options: { json?: boolean }) => {
      const repo = await withTaskSpinner(
        {
          silent: options.json,
          start: `Fetching repository owned by ${owner}...`,
          stop: "Repository retrieved",
        },
        () => reposService.getByOwner(owner),
      );

      if (output.json(repo, options.json)) {
        return;
      }

      if (!repo) {
        p.outro(brand.muted(`No repository found for owner '${owner}'.`));
        return;
      }

      renderRepoDetails(repo);
    });

  repos
    .command("purge-all")
    .description("Danger: Remove ALL connected repositories from your account")
    .action(async () => {
      p.intro(brand.error("Danger: Purge All Repositories "));

      const confirmed = await confirmOrAbort({
        active: "Yes, delete all",
        cancelMessage: "Purge cancelled.",
        danger: true,
        inactive: "Abort",
        message:
          "This will permanently remove EVERY connected repository and its analyses. Proceed?",
      });

      if (!confirmed) {
        return;
      }

      const result = await withTaskSpinner(
        {
          start: "Removing all repositories...",
          stop: "Repositories cleared",
        },
        () => reposService.deleteAll(),
      );

      p.outro(brand.success(result.message));
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
        const result = await withTaskSpinner(
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

        if (output.json(result, options.json)) {
          return;
        }

        if (result.items.length === 0) {
          p.outro(brand.muted("No repositories matched your query."));
          return;
        }

        console.log(
          renderSection(
            brand.logo("Connected Repositories (Slim View):"),
            renderSlimReposTable(result.items),
          ),
        );
        p.outro(
          brand.muted(`Found ${result.items.length} of ${result.meta.totalCount} repositories.`),
        );
      },
    );
}
