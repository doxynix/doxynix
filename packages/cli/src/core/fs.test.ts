import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";

import { join } from "pathe";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { describeLocalFileError, readLocalFile, readLocalFileIfExists, writeLocalFile } from "./fs";

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "dxnx-fs-"));
});

afterEach(() => {
  rmSync(dir, { force: true, recursive: true });
});

describe("readLocalFile", () => {
  it("returns the contents of an existing file", () => {
    const path = join(dir, "a.ts");
    writeFileSync(path, "export const a = 1;\n", "utf-8");

    expect(readLocalFile(path)).toEqual({ content: "export const a = 1;\n", ok: true });
  });

  it("reports a missing file instead of throwing", () => {
    const result = readLocalFile(join(dir, "absent.ts"));

    expect(result).toMatchObject({ error: { reason: "missing" }, ok: false });
  });

  it("reports a directory as a directory, not as unreadable content", () => {
    const result = readLocalFile(dir);

    expect(result).toMatchObject({ error: { reason: "directory" }, ok: false });
  });
});

describe("readLocalFileIfExists", () => {
  it("returns the string for a readable file", () => {
    const path = join(dir, "b.ts");
    writeFileSync(path, "x", "utf-8");

    expect(readLocalFileIfExists(path)).toBe("x");
  });

  it("returns null for a missing file", () => {
    expect(readLocalFileIfExists(join(dir, "gone.ts"))).toBeNull();
  });

  it("returns null for a directory", () => {
    expect(readLocalFileIfExists(dir)).toBeNull();
  });
});

describe("describeLocalFileError", () => {
  it.each([
    ["missing", "File not found"],
    ["directory", "is a directory"],
    ["read-failed", "Could not read file"],
  ] as const)("describes the %s reason", (reason, fragment) => {
    const message = describeLocalFileError("/tmp/x.ts", { reason });

    expect(message).toContain(fragment);
    expect(message).toContain("/tmp/x.ts");
  });
});

describe("writeLocalFile", () => {
  it("creates missing parent directories and writes the file", () => {
    const path = join(dir, "nested", "deep", "out.ts");

    const written = writeLocalFile(path, "written");

    expect(readLocalFile(path)).toEqual({ content: "written", ok: true });
    expect(written).toBe(path);
  });
});
