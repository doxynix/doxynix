import { describe, expect, it } from "vitest";

import { isGitHubUrl } from "@/shared/lib/github-url";

describe("shared/lib/utils:isGitHubUrl", () => {
  it("should return true for valid github URLs and short owner/repo paths", () => {
    const validInputs = [
      "https://github.com/facebook/react",
      // eslint-disable-next-line sonarjs/no-clear-text-protocols
      "http://github.com/vercel/next.js",
      "owner/repo",
      "/owner/repo",
      "https://gist.github.com/user/123",
    ];

    const results = validInputs.map((input) => isGitHubUrl(input));

    expect(results).toEqual([true, true, true, true, true]);
  });

  it("should return false for invalid or non-github inputs", () => {
    const invalidInputs = [
      "",
      "just-string",
      "https://google.com/repo",
      "https://githubx.com/owner/repo",
      // eslint-disable-next-line sonarjs/no-clear-text-protocols
      "ftp://github.com/owner/repo",
    ];

    const results = invalidInputs.map((input) => isGitHubUrl(input));

    expect(results).toEqual([false, false, false, false, false]);
  });

  it("should return true for ssh-style github remote", () => {
    expect(isGitHubUrl("git@github.com:owner/repo.git")).toBe(true);
  });

  it("should return false for malformed absolute URL", () => {
    expect(isGitHubUrl("https://[::1")).toBe(false);
  });
});
