import { existsSync, readFileSync, statSync } from "node:fs";

import { join, resolve } from "pathe";

export function getCurrentGitBranch(): string {
  const ciBranch =
    process.env.GITHUB_HEAD_REF ||
    process.env.GITHUB_REF_NAME ||
    process.env.CI_COMMIT_REF_NAME ||
    process.env.CIRCLE_BRANCH ||
    process.env.BITBUCKET_BRANCH;

  if (ciBranch && ciBranch !== "HEAD") {
    return ciBranch;
  }

  let currentDir = process.cwd();
  while (!existsSync(join(currentDir, ".git"))) {
    const parentDir = join(currentDir, "..");
    if (parentDir === currentDir) {
      return "main";
    }
    currentDir = parentDir;
  }

  try {
    const dotGitPath = join(currentDir, ".git");
    // A worktree's `.git` is a `gitdir:` pointer file holding an absolute path, so `join` would
    // nest it.
    const gitDirPath = statSync(dotGitPath).isDirectory()
      ? dotGitPath
      : resolve(
          currentDir,
          readFileSync(dotGitPath, "utf-8")
            .replace(/^gitdir:\s*/, "")
            .trim(),
        );

    const headContent = readFileSync(join(gitDirPath, "HEAD"), "utf-8").trim();

    if (headContent.startsWith("ref:")) {
      return headContent.split("/").pop() || "main";
    }

    return "main";
  } catch {
    return "main";
  }
}
