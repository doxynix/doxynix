import { afterEach, describe, expect, it, vi } from "vitest";

const resolveRepository = vi.hoisted(() => vi.fn());

vi.mock("@/core/repo", () => ({
  parseRepoTarget: (target: string) => {
    const [owner, name] = target.split("/");
    return owner && name ? { name, owner } : null;
  },
  resolveRepository,
}));

const analyzeService = vi.hoisted(() => ({ quickFileAudit: vi.fn() }));

vi.mock("./analyze.service", () => ({ analyzeService }));

import { Command } from "commander";

import { registerAnalyzeCommand } from "./analyze.command";

const runAudit = async (filePath: string) => {
  const written: string[] = [];
  vi.spyOn(process.stdout, "write").mockImplementation((chunk: unknown) => {
    written.push(String(chunk));
    return true;
  });

  resolveRepository.mockResolvedValue({
    name: "api",
    owner: "octo",
    repo: { id: "repo-1" },
    target: "octo/api",
  });

  const program = new Command().name("dxnx").exitOverride();
  registerAnalyzeCommand(program);
  await program.parseAsync([
    "node",
    "dxnx",
    "analyze",
    "audit",
    filePath,
    "-r",
    "octo/api",
    "--json",
  ]);

  const envelopes = written.map((chunk) => chunk.trim()).filter((chunk) => chunk.startsWith("{"));
  return { envelope: JSON.parse(envelopes.join("")) as unknown, service: analyzeService };
};

describe("analyze audit", () => {
  afterEach(() => {
    process.exitCode = 0;
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it("reports an unreadable file as a JSON failure instead of exiting 0", async () => {
    const { envelope, service } = await runAudit("src/__no-such-audit-target__.ts");

    expect(process.exitCode).toBe(1);
    expect(envelope).toEqual({
      code: "NOT_FOUND",
      error: "File not found: 'src/__no-such-audit-target__.ts'",
      success: false,
    });
    expect(service.quickFileAudit).not.toHaveBeenCalled();
  });
});
