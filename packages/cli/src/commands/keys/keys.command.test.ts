import { describe, expect, it, vi } from "vitest";

const keysService = vi.hoisted(() => ({
  create: vi.fn(),
  list: vi.fn(),
  revoke: vi.fn(),
  update: vi.fn(),
}));

vi.mock("./keys.service", () => ({ keysService }));

import { Command } from "commander";

import { registerKeysCommand } from "./keys.command";

const runCreate = async (argv: string[]) => {
  keysService.create.mockResolvedValue({ key: "dxnx_abcdefgh", prefix: "dxnx_abcdefgh" });
  const program = new Command().name("dxnx").exitOverride();
  registerKeysCommand(program);
  await program.parseAsync(["node", "dxnx", ...argv]);
  return keysService.create;
};

describe("keys create", () => {
  it("does not prompt for a description when -d is supplied", async () => {
    await runCreate(["keys", "create", "-n", "ci-test", "-d", "desc here"]);

    expect(keysService.create).toHaveBeenCalledWith({
      description: "desc here",
      name: "ci-test",
    });
  });

  it("never reaches the API when the description flag is absent and no TTY is available", async () => {
    // Without a TTY the prompt throws NonInteractiveError rather than hanging.
    await expect(runCreate(["keys", "create", "-n", "ci-test"])).rejects.toBeInstanceOf(Error);

    expect(keysService.create).not.toHaveBeenCalled();
  });
});
