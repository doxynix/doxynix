import { describe, expect, it } from "vitest";

import { getDynamicToolContext, getToolBaseLabel } from "./tool-context";

describe("getToolBaseLabel", () => {
  it("uses the provided label for known tools", () => {
    const labels = { getFileContent: "Read File" };
    expect(getToolBaseLabel("getFileContent", labels)).toBe("Read File");
  });

  it("derives a spaced label for unknown tools", () => {
    expect(getToolBaseLabel("openPullRequest", {})).toBe("Executing open Pull Request");
  });

  it("leaves single-word tool names untouched", () => {
    expect(getToolBaseLabel("finish", {})).toBe("Executing finish");
  });
});

describe("getDynamicToolContext", () => {
  it("returns null for null, undefined or non-object args", () => {
    expect(getDynamicToolContext("getFileContent", null)).toBeNull();
    expect(getDynamicToolContext("getFileContent", undefined)).toBeNull();
    expect(getDynamicToolContext("getFileContent", "path")).toBeNull();
  });

  it("resolves path for file tools, falling back to filePath", () => {
    expect(getDynamicToolContext("getFileContent", { path: "src/a.ts" })).toBe("src/a.ts");
    expect(getDynamicToolContext("quickFileAudit", { filePath: "src/b.ts" })).toBe("src/b.ts");
    expect(getDynamicToolContext("documentFile", { other: 1 })).toBeNull();
  });

  it("joins paths for readMultipleFiles", () => {
    expect(getDynamicToolContext("readMultipleFiles", { paths: ["a.ts", "b.ts"] })).toBe(
      "a.ts, b.ts",
    );
    expect(getDynamicToolContext("readMultipleFiles", { paths: "a.ts" })).toBeNull();
  });

  it("quotes the search term for search tools", () => {
    expect(getDynamicToolContext("searchWorkspace", { search: "map" })).toBe('"map"');
    expect(getDynamicToolContext("searchCode", { other: 1 })).toBeNull();
  });

  it("builds owner/name for repo tools", () => {
    expect(getDynamicToolContext("getBranches", { name: "doxynix", owner: "ivan" })).toBe(
      "ivan/doxynix",
    );
    expect(getDynamicToolContext("getRepoFiles", { owner: "ivan" })).toBeNull();
  });

  it("uses the title for PR tools", () => {
    expect(getDynamicToolContext("openPullRequest", { title: "Fix auth" })).toBe("Fix auth");
    expect(getDynamicToolContext("applyFix", { other: 1 })).toBeNull();
  });

  it("returns null for unknown tools", () => {
    expect(getDynamicToolContext("runTerminalCommand", { path: "x" })).toBeNull();
  });
});
