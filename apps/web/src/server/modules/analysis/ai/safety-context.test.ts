import { describe, expect, it } from "vitest";

import { getGlobalSafetyContext, SafetyContext } from "./safety-context";

describe("SafetyContext", () => {
  it("escapes xml text and attributes correctly in strict mode", () => {
    const ctx = new SafetyContext("strict");
    const raw = 'a & b <c> "quote"';

    const escapedText = ctx.escape(raw, "xml-text");
    expect(escapedText).toContain("&amp;");
    expect(escapedText).toContain("&lt;");
    expect(escapedText).toContain("&gt;");

    const escapedAttr = ctx.escape(raw, "xml-attr");
    expect(escapedAttr).toContain("&amp;");
    expect(escapedAttr).toContain("&lt;");
    expect(escapedAttr).toContain("&quot;");

    expect(ctx.escape("line\nbreak", "json")).toBe(JSON.stringify("line\nbreak"));
  });

  it("prepareFileContent truncates long content and escapes path", () => {
    const ctx = new SafetyContext("strict");
    const long = "x".repeat(60_000);
    const res = ctx.prepareFileContent("src/app.ts", long, 50_000);
    expect(res.truncated).toBe(true);
    expect(res.path).not.toContain("\n");
    expect(res.content).toContain("// [CONTENT TRUNCATED]");
  });

  it("prepareAllowedPaths joins and escapes paths", () => {
    const ctx = new SafetyContext("strict");
    const out = ctx.prepareAllowedPaths(["src/a.ts", "src/b.ts"]);
    expect(out).toContain("src/a.ts");
    expect(out).toContain("src/b.ts");
  });

  it("sanitizeUserInput rejects dangerous patterns in strict mode", () => {
    const ctx = new SafetyContext("strict");
    expect(() => ctx.sanitizeUserInput("please perform prompt injection")).toThrow(
      "Input contains potentially dangerous patterns",
    );
  });

  it("setSafetyLevel permissive disables escaping", () => {
    const ctx = new SafetyContext("permissive");
    expect(ctx.escape('<img src="x" onerror="alert(1)" />', "xml-text")).toContain("onerror");
  });

  it("validatePaths returns invalid entries when allowedPaths provided", () => {
    const ctx = new SafetyContext("strict");
    const allowed = new Set(["src/a.ts"]);
    const { invalid, valid } = ctx.validatePaths(["src/a.ts", "src/b.ts"], allowed);
    expect(valid).toEqual(["src/a.ts"]);
    expect(invalid).toEqual(["src/b.ts"]);
  });

  it("getGlobalSafetyContext returns singleton and can be reset by creating new with different level", () => {
    const g1 = getGlobalSafetyContext("strict");
    const g2 = getGlobalSafetyContext("strict");
    expect(g1).toBe(g2);
  });
});
