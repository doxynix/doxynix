import { execSync } from "node:child_process";

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

  try {
    const branch = execSync("git rev-parse --abbrev-ref HEAD", {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "ignore"],
    }).trim();

    if (!branch || branch === "HEAD") {
      return "main";
    }

    return branch;
  } catch {
    return "main";
  }
}
