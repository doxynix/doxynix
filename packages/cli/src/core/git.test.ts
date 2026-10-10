import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";

import { join } from "pathe";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { getCurrentGitBranch } from "./git";

const originalCwd = process.cwd();
const originalEnv = {
  BITBUCKET_BRANCH: process.env.BITBUCKET_BRANCH,
  CI_COMMIT_REF_NAME: process.env.CI_COMMIT_REF_NAME,
  CIRCLE_BRANCH: process.env.CIRCLE_BRANCH,
  GITHUB_HEAD_REF: process.env.GITHUB_HEAD_REF,
  GITHUB_REF_NAME: process.env.GITHUB_REF_NAME,
};

let tempDir: string;

function clearBranchEnv(): void {
  for (const key of Object.keys(originalEnv) as Array<keyof typeof originalEnv>) {
    delete process.env[key];
  }
}

function restoreBranchEnv(): void {
  clearBranchEnv();
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value !== undefined) {
      process.env[key] = value;
    }
  }
}

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), "dxnx-git-"));
  process.chdir(tempDir);
  clearBranchEnv();
});

afterEach(() => {
  restoreBranchEnv();
  process.chdir(originalCwd);
  rmSync(tempDir, { force: true, recursive: true });
});

describe("getCurrentGitBranch", () => {
  it("prefers the CI branch environment when present", () => {
    process.env.GITHUB_HEAD_REF = "feature/ci-run";

    expect(getCurrentGitBranch()).toBe("feature/ci-run");
  });

  it("reads the checked-out branch from .git/HEAD", () => {
    const gitDir = join(tempDir, ".git");
    mkdirSync(gitDir, { recursive: true });
    writeFileSync(join(gitDir, "HEAD"), "ref: refs/heads/release/cli\n", "utf-8");

    expect(getCurrentGitBranch()).toBe("cli");
  });

  it("falls back to main when no git metadata exists", () => {
    expect(getCurrentGitBranch()).toBe("main");
  });

  it("falls back to main when HEAD is detached", () => {
    const gitDir = join(tempDir, ".git");
    mkdirSync(gitDir, { recursive: true });
    writeFileSync(join(gitDir, "HEAD"), "9a7d4d0\n", "utf-8");

    expect(getCurrentGitBranch()).toBe("main");
  });
});
