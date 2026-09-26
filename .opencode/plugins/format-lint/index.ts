import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";

type ToolEvent = {
  status?: string;
  tool?: string;
  input?: unknown;
};

type PluginContext = {
  location: { directory: string; project: { canonical?: string } };
  tool: { hook: (name: string, cb: (event: unknown) => void | Promise<void>) => Promise<unknown> };
};

const MANAGED_EXTS = [".ts", ".tsx", ".mts", ".cts", ".json", ".jsonc"];

function touchedFile(input: unknown): string | null {
  if (input == null || typeof input !== "object") return null;
  const rec = input as Record<string, unknown>;
  for (const key of ["path", "filePath", "file", "filename"]) {
    const v = rec[key];
    if (typeof v === "string" && MANAGED_EXTS.some((ext) => v.endsWith(ext))) return v;
  }
  return null;
}

function run(cmd: string, args: string[], cwd: string): void {
  try {
    spawnSync(cmd, args, { cwd, stdio: "ignore", timeout: 60_000 });
  } catch {
    // Lint feedback is best-effort; never break the agent loop.
  }
}

export default {
  id: "format-lint",
  async setup(ctx: PluginContext) {
    // Workspace root of the project this plugin instance is loaded in.
    const root = ctx.location.project.canonical ?? ctx.location.directory;
    const biome = `${root}/node_modules/.bin/biome`;
    const oxlint = `${root}/node_modules/.bin/oxlint`;

    await ctx.tool.hook("execute.after", (raw) => {
      const event = raw as ToolEvent;
      if (event.status !== "completed") return;
      if (event.tool !== "edit" && event.tool !== "write") return;
      const file = touchedFile(event.input);
      if (file == null) return;
      // Repo standard: Biome + Oxlint only, never ESLint/Prettier.
      // Repo-pinned binaries directly — no bunx resolution, no network.
      if (existsSync(biome)) run(biome, ["check", "--write", file], root);
      if (existsSync(oxlint)) run(oxlint, ["--fix", file], root);
    });
  },
};
