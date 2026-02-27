import { isBinaryFile } from "isbinaryfile";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { cleanCodeForAi, CodeOptimizer, isBinary, unwrapAiText } from "@/server/utils/optimizers";

vi.mock("isbinaryfile", () => ({
  isBinaryFile: vi.fn(),
}));

describe("CodeOptimizer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should remove extra blank lines and trailing spaces in basicClean", () => {
    const input = "\n\n const a = 1;   \n\n const b = 2; \n";

    const result = CodeOptimizer.basicClean(input);

    expect(result).toBe("const a = 1;\n const b = 2;");
  });

  it("should redact emails, ip addresses and jwt tokens", () => {
    const input = `Email: test@mail.com IP: 192.168.0.1 Token: "eyJabc.def.ghi"`;

    const result = CodeOptimizer.redactSecrets(input);

    expect(result).toContain("<REDACTED_EMAIL>");
    expect(result).toContain("<REDACTED_IP>");
    expect(result).toContain("<REDACTED_JWT>");
  });

  it("should remove leading license header", () => {
    const input = "/* Copyright 2026, license */\nconst value = 1;";

    const result = CodeOptimizer.removeLicenseHeaders(input);

    expect(result).toBe("\nconst value = 1;");
  });

  it("should truncate large numeric arrays", () => {
    const largeArray = `[${"1,".repeat(300)}]`;

    const result = CodeOptimizer.truncateLargeDataStructures(largeArray);

    expect(result).toContain("/* large data array truncated */");
  });

  it("should truncate long d literals and large base64 data urls", () => {
    const longLiteral = `const path = d="${"a".repeat(160)}";`;
    const base64Literal = `"data:image/png;base64,${"x".repeat(60)}"`;
    const input = `${longLiteral}\n${base64Literal}`;

    const result = CodeOptimizer.truncateLargeLiterals(input);

    expect(result).toContain("/* ...content truncated... */");
  });

  it("should skip truncating large arrays for config and json files", () => {
    const largeArray = `[${"1,".repeat(300)}]`;

    const fromConfig = CodeOptimizer.optimize(largeArray, "app.config.ts");
    const fromJson = CodeOptimizer.optimize(largeArray, "package.json");

    expect(fromConfig).not.toContain("large data array truncated");
    expect(fromJson).not.toContain("large data array truncated");
  });

  it("should run full optimize pipeline in cleanCodeForAi", () => {
    const input = "Email test@mail.com\n\n const a = 1;  ";

    const result = cleanCodeForAi(input, "file.ts");

    expect(result).toContain("<REDACTED_EMAIL>");
    expect(result.startsWith("Email")).toBe(true);
  });
});

describe("unwrapAiText", () => {
  it("should return empty string for nullish values", () => {
    expect(unwrapAiText(null)).toBe("");
    expect(unwrapAiText(undefined)).toBe("");
  });

  it("should return string as is", () => {
    expect(unwrapAiText("plain text")).toBe("plain text");
  });

  it("should return ai-like text/content/output when they are strings", () => {
    expect(unwrapAiText({ text: "text value" })).toBe("text value");
    expect(unwrapAiText({ content: "content value" })).toBe("content value");
    expect(unwrapAiText({ output: "output value" })).toBe("output value");
  });

  it("should stringify ai-like object when candidate is not string", () => {
    const value = { content: { nested: true } };

    expect(unwrapAiText(value)).toBe(JSON.stringify(value));
  });

  it("should stringify plain objects and join arrays with new lines", () => {
    expect(unwrapAiText({ a: 1 })).toBe('{"a":1}');
    expect(unwrapAiText(["a", "b", "c"])).toBe("a\nb\nc");
  });

  it("should handle Date and RegExp objects as non ai-like values", () => {
    const date = new Date("2026-01-01T00:00:00.000Z");
    const regex = /abc/gi;

    expect(unwrapAiText(date)).toBe(JSON.stringify(date));
    expect(unwrapAiText(regex)).toBe("{}");
  });

  it("should convert primitive non-string values to strings", () => {
    expect(unwrapAiText(42)).toBe("42");
    expect(unwrapAiText(false)).toBe("false");
  });
});

describe("isBinary", () => {
  it("should proxy to isBinaryFile", async () => {
    vi.mocked(isBinaryFile).mockResolvedValue(true);
    const buffer = Buffer.from([0, 255, 10]);

    const result = await isBinary(buffer);

    expect(result).toBe(true);
    expect(isBinaryFile).toHaveBeenCalledWith(buffer);
  });
});
