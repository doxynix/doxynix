import { describe, expect, it } from "vitest";

import { countTokens } from "./tokenizer";

// One representative sample per writing system/script family. Tokenization is
// script-level behavior, not per-language, so a small matrix covers the world.
const SCRIPT_SAMPLES = [
  ["ASCII", "semantic parsing and safe fallback heuristics"],
  ["Latin with accents", "Crème brûlée café naïve"],
  ["Cyrillic", "Привет мир, тестирование подсчета токенов"],
  ["Han", "中文分词测试"],
  ["Hiragana", "こんにちは世界"],
  ["Hangul", "한국어 텍스트 분석"],
  ["Arabic", "مرحبا بالعالم"],
  ["Hebrew", "שלום עולם"],
  ["Devanagari", "नमस्ते दुनिया"],
  ["Greek", "γειά σου κόσμε"],
  ["Emoji", "hello 👨👩👧👦 world 🌍"],
] as const;

describe("countTokens", () => {
  it("returns zero for blank input", async () => {
    await expect(countTokens("   ")).resolves.toBe(0);
    await expect(countTokens("")).resolves.toBe(0);
  });

  it("counts visible text with a positive estimate", async () => {
    const tokens = await countTokens("semantic parsing and safe fallback heuristics");
    expect(tokens).toBeGreaterThan(0);
    expect(tokens).toBeTypeOf("number");
  });

  it.each(SCRIPT_SAMPLES)("counts %s text", async (_label, sample) => {
    await expect(countTokens(sample)).resolves.toBeGreaterThan(0);
  });

  it("is deterministic for the same input", async () => {
    const sample = "Привет мир, тестирование подсчета токенов";
    const first = await countTokens(sample);
    const second = await countTokens(sample);
    expect(first).toBe(second);
  });
});
