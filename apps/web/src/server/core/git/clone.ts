import fs from "node:fs/promises";

import type { Repo } from "@prisma/client";
import simpleGit from "simple-git";

import { taskLogger } from "@/server/utils/task-logger";

import { parseGitUrl } from "./parse-url";

export async function cloneRepository(
  repo: Repo,
  token: null | string | undefined,
  targetPath: string,
  selectedBranch?: string,
) {
  const branchToClone = selectedBranch ?? repo.defaultBranch;

  taskLogger.info(`Git: Initializing clone for ${repo.owner}/${repo.name} [${branchToClone}]...`);

  await fs.rm(targetPath, { force: true, recursive: true });
  await fs.mkdir(targetPath, { recursive: true });

  const git = simpleGit();
  const parsed = parseGitUrl(repo.url);
  const repoUrl = `https://${parsed.resource}/${parsed.full_name}.git`;

  const options = ["--filter=blob:none", "--single-branch", "--branch", branchToClone, "--no-tags"];
  if (token != null) {
    const basicAuth = Buffer.from(`x-access-token:${token}`).toString("base64");
    options.push("-c", `http.extraheader=Authorization: Basic ${basicAuth}`);
  }

  try {
    await git.clone(repoUrl, targetPath, options);
    await git.cwd(targetPath);

    taskLogger.success("Git: Repository cloned to local worker storage");
  } catch (error) {
    await fs.rm(targetPath, { force: true, recursive: true });

    const raw = error instanceof Error ? error.message : String(error);
    const safe = token != null ? raw.replaceAll(token, "***") : raw;
    taskLogger.error(`Git: Clone failed. ${safe}`);
    throw new Error(`Failed to clone repository: ${safe}`, { cause: error });
  }
}

export function shouldUseCache(options: {
  forceRefresh?: boolean;
  lastSuccessfulSha?: string;
  currentSha: string;
}): boolean {
  if (options.forceRefresh === true) {
    return false;
  }
  return options.lastSuccessfulSha === options.currentSha;
}
