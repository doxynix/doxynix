import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";

import { join } from "pathe";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  buildCreateFixPayload,
  buildSingleFinding,
  collectFileContents,
  parseFindingsFile,
  parseLineArg,
} from "./pr.findings";

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "dxnx-findings-"));
});

afterEach(() => {
  rmSync(dir, { force: true, recursive: true });
});

function writeFixture(name: string, contents: string): string {
  const path = join(dir, name);
  writeFileSync(path, contents, "utf-8");
  return path;
}

describe("parseFindingsFile", () => {
  it("accepts a well-formed findings array", () => {
    const path = writeFixture(
      "good.json",
      JSON.stringify([{ file: "a.ts", line: 3, suggestion: "fix it", type: "XSS" }]),
    );

    expect(parseFindingsFile(path)).toEqual({
      findings: [{ file: "a.ts", line: 3, suggestion: "fix it", type: "XSS" }],
      ok: true,
    });
  });

  it("rejects an array whose element fields have the wrong types", () => {
    const path = writeFixture(
      "badtypes.json",
      JSON.stringify([{ file: 123, line: "3", type: "XSS" }]),
    );

    expect(parseFindingsFile(path)).toMatchObject({
      message: expect.stringContaining("not a valid findings array"),
      ok: false,
    });
    const result = parseFindingsFile(path);
    expect(result).toMatchObject({
      message: expect.stringContaining("0.file"),
      ok: false,
    });
  });

  it("rejects an array missing a required field", () => {
    const path = writeFixture("missing.json", JSON.stringify([{ file: "a.ts", line: 3 }]));

    expect(parseFindingsFile(path)).toMatchObject({
      message: expect.stringContaining("0.type"),
      ok: false,
    });
  });

  it("rejects a non-array JSON document", () => {
    const path = writeFixture("object.json", JSON.stringify({ file: "a.ts" }));

    expect(parseFindingsFile(path)).toMatchObject({ ok: false });
  });

  it("reports malformed JSON distinctly from a schema mismatch", () => {
    const path = writeFixture("broken.json", "{not json");

    expect(parseFindingsFile(path)).toMatchObject({
      message: expect.stringContaining("Invalid JSON"),
      ok: false,
    });
  });

  it("reports a missing file as not found", () => {
    const result = parseFindingsFile(join(dir, "absent.json"));

    expect(result).toMatchObject({
      message: expect.stringContaining("not found"),
      ok: false,
    });
  });
});

describe("parseLineArg", () => {
  it("keeps a valid positive integer", () => {
    expect(parseLineArg("42")).toBe(42);
  });

  it.each([
    ["0", 1],
    ["-3", 1],
    ["abc", 1],
    [undefined, 1],
    ["1.5", 1],
  ] as const)("falls back to 1 for %s", (input, expected) => {
    expect(parseLineArg(input)).toBe(expected);
  });
});

describe("collectFileContents", () => {
  it("reads contents for each finding and omits unreadable paths", () => {
    const present = writeFixture("present.ts", "export const a = 1;\n");
    const findings = buildSingleFinding({ file: present, message: "hardcoded" });

    const contents = collectFileContents(findings);

    expect(contents[present]).toBe("export const a = 1;\n");
  });

  it("returns an empty record when every referenced file is absent", () => {
    const contents = collectFileContents([
      { file: join(dir, "ghost.ts"), line: 1, suggestion: "x", type: "CODE_SMELL" },
    ]);

    expect(contents).toEqual({});
  });
});

describe("buildSingleFinding", () => {
  it("produces one CODE_SMELL finding with the parsed line", () => {
    const findings = buildSingleFinding({
      file: "src/a.ts",
      line: "7",
      message: "SQL injection",
    });

    expect(findings).toEqual([
      { file: "src/a.ts", line: 7, suggestion: "SQL injection", type: "CODE_SMELL" },
    ]);
  });
});

describe("buildCreateFixPayload", () => {
  it("carries repoId, findings and their file contents together", () => {
    const file = writeFixture("src.ts", "const x = 1;\n");

    const payload = buildCreateFixPayload({
      findings: buildSingleFinding({ file, message: "m" }),
      repoId: "0192f1c4-0000-7000-8000-000000000000",
    });

    expect(payload.repoId).toBe("0192f1c4-0000-7000-8000-000000000000");
    expect(payload.findings).toHaveLength(1);
    expect(payload.fileContents).toBeDefined();
    expect(payload.fileContents?.[file]).toBe("const x = 1;\n");
    expect(payload.prAnalysisId).toBeUndefined();
  });
});
