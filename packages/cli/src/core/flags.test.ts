import { Command } from "commander";
import { describe, expect, it } from "vitest";

import { registerConfirmFlagsRecursively } from "./flags";

const buildProgram = () => {
  const program = new Command().name("dxnx").exitOverride();
  const group = program.command("keys").exitOverride();
  const leaf = group.command("create").option("-n, --name <name>", "Key name").exitOverride();
  return { leaf, program };
};

describe("registerConfirmFlagsRecursively", () => {
  it("adds --yes and --force to the root and every subcommand", () => {
    const { leaf, program } = buildProgram();

    registerConfirmFlagsRecursively(program);

    expect(program.options.map((o) => o.long)).toEqual(["--yes", "--force"]);
    expect(program.commands[0]?.options.map((o) => o.long)).toEqual(["--yes", "--force"]);
    expect(leaf.options.map((o) => o.long)).toEqual(["--name", "--yes", "--force"]);
  });

  it("parses -y, --yes and --force without rejecting them as unknown options", () => {
    const { leaf, program } = buildProgram();
    registerConfirmFlagsRecursively(program);

    let parsed: Record<string, boolean> = {};
    leaf.action((options: Record<string, boolean>) => {
      parsed = options;
    });

    program.parse(["node", "dxnx", "keys", "create", "-y", "--force", "-n", "ci"]);

    // The root consumes the shared flags before the leaf sees them; what matters is
    // that nothing is rejected and the leaf still parses its own options.
    expect(parsed).toEqual({ name: "ci" });
    expect(program.opts()).toMatchObject({ force: true, yes: true });
  });
});
