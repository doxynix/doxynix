import type * as ClackPrompts from "@clack/prompts";
import { DocTypeSchema } from "@doxynix/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const prompts = vi.hoisted(() => ({
  intro: vi.fn(),
  note: vi.fn(),
  outro: vi.fn(),
  select: vi.fn(),
}));

vi.mock("@clack/prompts", async (importOriginal) => ({
  ...(await importOriginal<typeof ClackPrompts>()),
  intro: prompts.intro,
  note: prompts.note,
  outro: prompts.outro,
  select: prompts.select,
}));

const resolveRepository = vi.hoisted(() => vi.fn());

vi.mock("@/core/repo", () => ({
  parseRepoTarget: (target: string) => {
    const [owner, name] = target.split("/");
    return owner && name ? { name, owner } : null;
  },
  resolveRepository,
}));

const docsService = vi.hoisted(() => ({ getDocumentContent: vi.fn() }));

vi.mock("./docs.service", () => ({ docsService }));

import { Command } from "commander";

import { registerDocsCommand } from "./docs.command";

const runView = async (argv: string[]) => {
  const program = new Command().name("dxnx").exitOverride();
  registerDocsCommand(program);
  await program.parseAsync(["node", "dxnx", ...argv]);
};

const originalIsTTY = process.stdin.isTTY;

beforeEach(() => {
  // The vitest worker has no controlling terminal, so force one for the picker path.
  process.stdin.isTTY = true;
  process.stdout.isTTY = true;
  resolveRepository.mockResolvedValue({
    name: "api",
    owner: "octo",
    repo: { id: "repo-1" },
    target: "octo/api",
  });
  docsService.getDocumentContent.mockResolvedValue({ raw: "" });
});

afterEach(() => {
  process.stdin.isTTY = originalIsTTY;
  process.exitCode = 0;
  vi.clearAllMocks();
});

describe("docs view document types", () => {
  it("offers every generated DocType in the interactive picker", async () => {
    prompts.select.mockResolvedValue("CHANGELOG");

    await runView(["docs", "view", "octo/api"]);

    const offered: { label: string; value: string }[] =
      prompts.select.mock.calls[0]?.[0]?.options ?? [];
    expect(offered.map((option) => option.value)).toEqual([...DocTypeSchema.options]);
    expect(offered.map((option) => option.label)).toContain(" CHANGELOG (Release History)");
    expect(docsService.getDocumentContent).toHaveBeenCalledWith(
      "repo-1",
      "CHANGELOG",
      undefined,
      undefined,
    );
  });

  it("rejects a type the generated enum does not contain", async () => {
    await runView(["docs", "view", "octo/api", "--type", "WIKI"]);

    expect(process.exitCode).toBe(1);
    expect(docsService.getDocumentContent).not.toHaveBeenCalled();
    expect(prompts.select).not.toHaveBeenCalled();
  });
});
