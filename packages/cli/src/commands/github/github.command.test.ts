import { afterEach, describe, expect, it, vi } from "vitest";

const githubService = vi.hoisted(() => ({
  getBranches: vi.fn(),
  getRepoFiles: vi.fn(),
}));

vi.mock("./github.service", () => ({ githubService }));

import { Command } from "commander";

import { registerGithubCommand } from "./github.command";

const runFormatError = async (argv: string[]) => {
  const written: string[] = [];
  vi.spyOn(process.stdout, "write").mockImplementation((chunk: unknown) => {
    written.push(String(chunk));
    return true;
  });

  const program = new Command().name("dxnx").exitOverride();
  registerGithubCommand(program);
  await program.parseAsync(["node", "dxnx", ...argv]);

  const envelopes = written.map((chunk) => chunk.trim()).filter((chunk) => chunk.startsWith("{"));
  return envelopes.length > 0 ? (JSON.parse(envelopes.join("")) as unknown) : undefined;
};

describe("github target format errors", () => {
  afterEach(() => {
    process.exitCode = 0;
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it.each([
    { argv: ["github", "branches", "no-slash", "--json"], command: "branches" },
    { argv: ["github", "tree", "no-slash", "--json"], command: "tree" },
  ])("fails $command in JSON mode with a non-zero exit code", async ({ argv }) => {
    const envelope = await runFormatError(argv);

    expect(process.exitCode).toBe(1);
    expect(envelope).toEqual({
      code: "BAD_REQUEST",
      error: "Format must be: owner/name (e.g. facebook/react)",
      success: false,
    });
    expect(githubService.getBranches).not.toHaveBeenCalled();
    expect(githubService.getRepoFiles).not.toHaveBeenCalled();
  });

  it("leaves `github cat`, which has no --json flag, on the human-readable path", async () => {
    const envelope = await runFormatError(["github", "cat", "no-slash", "src/index.ts"]);

    expect(envelope).toBeUndefined();
    expect(process.exitCode).toBe(0);
  });
});
