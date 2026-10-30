import { describe, expect, it } from "vitest";

import { costCentsFor, priceFor, totalTokens, UnknownModelPriceError } from "./billing.price";

const MODEL = "gemini-3.5-flash-lite";
const BEFORE_REPRICE = new Date("2026-03-01T00:00:00.000Z");
const AFTER_REPRICE = new Date("2026-07-01T00:00:00.000Z");

describe("priceFor", () => {
  it("returns the price of each token class", () => {
    expect(priceFor(MODEL, "input", BEFORE_REPRICE)).toBe(7.5);
    expect(priceFor(MODEL, "cachedInput", BEFORE_REPRICE)).toBe(1.875);
    expect(priceFor(MODEL, "output", BEFORE_REPRICE)).toBe(30);
  });

  it("uses the entry effective at the given date", () => {
    expect(priceFor(MODEL, "input", BEFORE_REPRICE)).toBe(7.5);
    expect(priceFor(MODEL, "input", AFTER_REPRICE)).toBe(10);
  });

  it("throws for a model that is not in the table", () => {
    expect(() => priceFor("some-unlisted-model", "input")).toThrow(UnknownModelPriceError);
  });

  it("throws when no price is effective yet", () => {
    expect(() => priceFor(MODEL, "input", new Date("2020-01-01T00:00:00.000Z"))).toThrow(
      UnknownModelPriceError,
    );
  });
});

describe("costCentsFor", () => {
  it("prices each class and rounds up to whole cents", () => {
    const cost = costCentsFor(
      MODEL,
      { cachedInputTokens: 0, inputTokens: 1_000_000, outputTokens: 0 },
      BEFORE_REPRICE,
    );

    expect(cost).toBe(BigInt(8));
  });

  it("adds input, cached input and output", () => {
    const cost = costCentsFor(
      MODEL,
      { cachedInputTokens: 1_000_000, inputTokens: 1_000_000, outputTokens: 1_000_000 },
      BEFORE_REPRICE,
    );

    // 7.5 + 1.875 + 30 = 39.375 -> 40 cents.
    expect(cost).toBe(BigInt(40));
  });

  it("is zero for an empty usage", () => {
    expect(costCentsFor(MODEL, { cachedInputTokens: 0, inputTokens: 0, outputTokens: 0 })).toBe(
      BigInt(0),
    );
  });

  it("counts every class in totalTokens", () => {
    expect(totalTokens({ cachedInputTokens: 10, inputTokens: 20, outputTokens: 30 })).toBe(60);
  });
});
