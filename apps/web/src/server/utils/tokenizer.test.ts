import { describe, expect, it } from "vitest";

import { countTokens } from "./tokenizer";

describe("countTokens", () => {
  it("returns zero for blank input", async () => {
    await expect(countTokens("   ")).resolves.toBe(0);
    await expect(countTokens("")).resolves.toBe(0);
  });

  it("counts visible text with a positive heuristic estimate", async () => {
    const tokens = await countTokens("semantic parsing and safe fallback heuristics");
    expect(tokens).toBeGreaterThan(0);
    expect(tokens).toBeTypeOf("number");
  });

  it("handles CJK and multilingual text correctly", async () => {
    const cjkTokens = await countTokens("こんにちは世界 (Hello world in Japanese)");
    const cyrillicTokens = await countTokens("Привет мир, тестирование подсчета токенов");

    expect(cjkTokens).toBeGreaterThan(0);
    expect(cyrillicTokens).toBeGreaterThan(0);
  });
});
