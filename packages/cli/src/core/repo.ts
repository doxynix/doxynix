import * as p from "@clack/prompts";

import { brand, pc } from "@/ui/colors";
import { withTaskSpinner } from "@/ui/spinner";

import type { RepoDetails } from "@/commands/repos/repos.types";

import { trpc } from "./client";
import { guardPrompt } from "./prompts";

export function parseRepoTarget(target: string): { name: string; owner: string } | null {
  const parts = target.split("/");
  if (parts.length !== 2 || !parts[0]?.trim() || !parts[1]?.trim()) {
    return null;
  }
  return { name: parts[1].trim(), owner: parts[0].trim() };
}

export async function resolveRepository(
  target?: string,
  promptMessage = "Select repository context:",
): Promise<{
  name: string;
  owner: string;
  repo: RepoDetails;
  target: string;
} | null> {
  let repoTarget = target;

  if (!repoTarget) {
    const RECENT_LIMIT = 25;

    const result = await withTaskSpinner("Loading recent repositories...", () =>
      trpc.repo.getAll.query({
        cursor: 1,
        limit: RECENT_LIMIT,
        sortBy: "createdAt",
        sortOrder: "desc",
      }),
    );

    if (result.items.length === 0) {
      p.outro(
        brand.muted("Connect a repository first: ") + brand.highlight("dxnx repos add <url>"),
      );
      return null;
    }

    const options: Array<{ label: string; value: string }> = result.items.map((r) => ({
      label: `${r.owner}/${r.name} (${r.language ?? "Other"})`,
      value: `${r.owner}/${r.name}`,
    }));

    const totalCount = result.meta?.totalCount ?? result.items.length;
    if (totalCount > RECENT_LIMIT) {
      options.push({
        label: pc.cyan("🔍 Search repository by name..."),
        value: "__SEARCH__",
      });
    }

    const selected = await guardPrompt(
      p.select({
        message: `${promptMessage} ${brand.muted(`(showing recent ${result.items.length} of ${totalCount})`)}`,
        options,
      }),
      "Cancelled.",
    );

    if (selected === "__SEARCH__") {
      const query = await guardPrompt(
        p.text({
          message: "Enter repository name or keyword:",
          placeholder: "e.g. backend or my-service",
          validate: (val) => (!val?.trim() ? "Search query cannot be empty" : undefined),
        }),
        "Search cancelled.",
      );

      const searchResult = await withTaskSpinner(`Searching for '${query.trim()}'...`, () =>
        trpc.repo.getAll.query({
          limit: 25,
          search: query.trim(),
        }),
      );

      if (searchResult.items.length === 0) {
        p.outro(brand.error(`No repositories found matching '${query.trim()}'.`));
        return null;
      }

      repoTarget = await guardPrompt(
        p.select({
          message: "Select matching repository:",
          options: searchResult.items.map((r) => ({
            label: `${r.owner}/${r.name} (${r.language ?? "Other"})`,
            value: `${r.owner}/${r.name}`,
          })),
        }),
        "Cancelled.",
      );
    } else {
      repoTarget = selected;
    }
  }

  const parsed = parseRepoTarget(repoTarget);
  if (!parsed) {
    p.outro(brand.error("Format must be: owner/name (e.g. facebook/react)"));
    return null;
  }

  const repo = await withTaskSpinner(`Resolving repository ${parsed.owner}/${parsed.name}...`, () =>
    trpc.repo.getByName.query({ name: parsed.name, owner: parsed.owner }),
  );

  if (!repo) {
    p.outro(brand.error(`Repository ${repoTarget} was not found.`));
    return null;
  }

  return {
    name: parsed.name,
    owner: parsed.owner,
    repo,
    target: `${parsed.owner}/${parsed.name}`,
  };
}
