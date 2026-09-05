import * as p from "@clack/prompts";

import { brand } from "@/ui/colors";

import { type RouterOutput, trpc } from "./client";

export type RepoRecord = NonNullable<RouterOutput["repo"]["getByName"]>;

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
  repo: RepoRecord;
  target: string;
} | null> {
  let repoTarget = target;

  if (!repoTarget) {
    const res = await trpc.repo.getAll.query({
      limit: 50,
      sortBy: "createdAt",
      sortOrder: "desc",
    });

    if (res.items.length === 0) {
      p.outro(
        brand.muted("Connect a repository first: ") + brand.highlight("dxnx repos add <url>"),
      );
      return null;
    }

    const selection = await p.select({
      message: promptMessage,
      options: res.items.map((r) => ({
        label: `${r.owner}/${r.name} (${r.language ?? "Other"})`,
        value: `${r.owner}/${r.name}`,
      })),
    });

    if (p.isCancel(selection) || typeof selection !== "string") {
      p.cancel("Cancelled.");
      return null;
    }
    repoTarget = selection;
  }

  const parsed = parseRepoTarget(repoTarget);
  if (!parsed) {
    p.outro(brand.error("Format must be: owner/name (e.g. facebook/react)"));
    return null;
  }

  const repo = await trpc.repo.getByName.query({ name: parsed.name, owner: parsed.owner });
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
