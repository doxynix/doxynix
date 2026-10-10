import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";

import { join } from "pathe";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { checkCliUpdate, isNewerVersion } from "./updater";

let tempDir: string;
let originalArgv: string[];
let originalIsTty: boolean | undefined;
let consoleError: ReturnType<typeof vi.spyOn>;

function cachePath(): string {
  return join(tempDir, "dxnx", "update-check.json");
}

function writeCache(lastChecked: number, latestVersion: string): void {
  mkdirSync(join(tempDir, "dxnx"), { recursive: true });
  writeFileSync(cachePath(), JSON.stringify({ lastChecked, latestVersion }), "utf-8");
}

// The banner goes through console.error, not process.stderr.write directly.
function bannerOutput(): string {
  return consoleError.mock.calls.map((call: unknown[]) => String(call[0])).join("");
}

beforeEach(() => {
  originalArgv = [...process.argv];
  originalIsTty = process.stdout.isTTY;
  tempDir = mkdtempSync(join(tmpdir(), "dxnx-updater-"));
  process.env.XDG_CONFIG_HOME = tempDir;
  process.argv = ["node", "dxnx"];
  Object.defineProperty(process.stdout, "isTTY", { configurable: true, value: true });
  consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  process.argv = originalArgv;
  if (originalIsTty === undefined) {
    Reflect.deleteProperty(process.stdout, "isTTY");
  } else {
    Object.defineProperty(process.stdout, "isTTY", { configurable: true, value: originalIsTty });
  }
  delete process.env.XDG_CONFIG_HOME;
  rmSync(tempDir, { force: true, recursive: true });
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("isNewerVersion", () => {
  it.each([
    ["1.0.0", "1.0.1", true],
    ["1.0.0", "1.1.0", true],
    ["1.0.0", "2.0.0", true],
    ["1.0.1", "1.0.0", false],
    ["2.0.0", "1.9.9", false],
    ["1.9.9", "1.10.0", true],
    ["1.10.0", "1.9.0", false],
    ["1.0.0", "1.0.0", false],
  ])("compares %s against %s as %s", (current, latest, expected) => {
    expect(isNewerVersion(current, latest)).toBe(expected);
  });

  it("treats a short version as zero-padded rather than newer", () => {
    expect(isNewerVersion("1.0", "1.0.1")).toBe(true);
    expect(isNewerVersion("1", "1.0.1")).toBe(true);
    expect(isNewerVersion("1.0.0", "1.0")).toBe(false);
  });

  it("ignores non-numeric segments instead of producing NaN", () => {
    expect(isNewerVersion("1.0.0", "1.0.x")).toBe(false);
    expect(isNewerVersion("1.0.0-beta", "1.0.0")).toBe(false);
  });
});

describe("checkCliUpdate", () => {
  it("does nothing when --json is requested, so output stays machine readable", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    process.argv = ["node", "dxnx", "--json"];

    checkCliUpdate("1.0.0");

    expect(fetchMock).not.toHaveBeenCalled();
    expect(bannerOutput()).toBe("");
  });

  it("does nothing when stdout is not a TTY", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    Object.defineProperty(process.stdout, "isTTY", { configurable: true, value: false });

    checkCliUpdate("1.0.0");

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("announces an update when the cached latest version is ahead", () => {
    vi.stubGlobal("fetch", vi.fn());
    writeCache(Date.now(), "9.9.9");

    checkCliUpdate("1.0.0");

    expect(bannerOutput()).toContain("UPDATE AVAILABLE");
    expect(bannerOutput()).toContain("9.9.9");
  });

  it("stays silent when the cached latest version is not ahead", () => {
    vi.stubGlobal("fetch", vi.fn());
    writeCache(Date.now(), "1.0.0");

    checkCliUpdate("1.0.0");

    expect(bannerOutput()).toBe("");
  });

  it("stays silent when the running version is ahead of the cache", () => {
    vi.stubGlobal("fetch", vi.fn());
    writeCache(Date.now(), "1.0.0");

    checkCliUpdate("2.0.0");

    expect(bannerOutput()).toBe("");
  });

  it("tells the user how to update using bun, not npm", () => {
    vi.stubGlobal("fetch", vi.fn());
    writeCache(Date.now(), "9.9.9");

    checkCliUpdate("1.0.0");

    expect(bannerOutput()).toContain("bun add -g @doxynix/cli");
    expect(bannerOutput()).not.toContain("npm install");
  });

  it("does not hit the network while the cache is still fresh", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    writeCache(Date.now(), "1.0.0");

    checkCliUpdate("1.0.0");

    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("refreshes a stale cache and stores the registry version", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      json: async () => ({ version: "2.5.0" }),
      ok: true,
    });
    vi.stubGlobal("fetch", fetchMock);
    writeCache(Date.now() - 48 * 60 * 60 * 1000, "1.0.0");

    checkCliUpdate("1.0.0");

    await vi.waitFor(() => {
      expect(JSON.parse(readFileSync(cachePath(), "utf-8")).latestVersion).toBe("2.5.0");
    });
  });

  it("queries the CLI package on the public registry", () => {
    const fetchMock = vi.fn().mockResolvedValue({ json: async () => ({}), ok: true });
    vi.stubGlobal("fetch", fetchMock);

    checkCliUpdate("1.0.0");

    expect(fetchMock.mock.calls[0]?.[0]).toContain("@doxynix/cli");
  });

  it("survives a network failure without throwing or caching", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));

    expect(() => checkCliUpdate("1.0.0")).not.toThrow();

    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(bannerOutput()).toBe("");
  });

  it("ignores a non-ok registry response", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ json: async () => ({}), ok: false });
    vi.stubGlobal("fetch", fetchMock);

    checkCliUpdate("1.0.0");

    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(() => readFileSync(cachePath(), "utf-8")).toThrow(/ENOENT/);
  });

  it("ignores a payload without a version field", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ json: async () => ({}), ok: true });
    vi.stubGlobal("fetch", fetchMock);

    checkCliUpdate("1.0.0");

    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(() => readFileSync(cachePath(), "utf-8")).toThrow(/ENOENT/);
  });

  it("recovers from a corrupt cache file instead of crashing", () => {
    const fetchMock = vi.fn().mockResolvedValue({
      json: async () => ({ version: "3.0.0" }),
      ok: true,
    });
    vi.stubGlobal("fetch", fetchMock);
    mkdirSync(join(tempDir, "dxnx"), { recursive: true });
    writeFileSync(cachePath(), "{ this is not json", "utf-8");

    expect(() => checkCliUpdate("1.0.0")).not.toThrow();
  });
});
