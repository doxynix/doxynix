import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

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
    const gitHeadPath = join(currentDir, ".git", "HEAD");
    const headContent = readFileSync(gitHeadPath, "utf-8").trim();

    if (headContent.startsWith("ref:")) {
      return headContent.split("/").pop() || "main";
    }

    return "main";
  } catch {
    return "main";
  }
}
