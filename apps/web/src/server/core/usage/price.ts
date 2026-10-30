export type TokenClass = "cachedInput" | "input" | "output";

export type TokenUsage = {
  cachedInputTokens: number;
  inputTokens: number;
  outputTokens: number;
};

type PriceEntry = {
  cachedInput: number;
  effectiveFrom: string;
  input: number;
  output: number;
};

// Product configuration, not a vendor fact: cents per million tokens, with the date the price took
// effect. Update here when a model is added or repriced; never derive cost from a vendor invoice.
const PRICE_TABLE: Record<string, PriceEntry[]> = {
  "gemini-3.5-flash": [{ cachedInput: 7.5, effectiveFrom: "2026-01-01", input: 30, output: 250 }],
  "gemini-3.5-flash-lite": [
    { cachedInput: 1.875, effectiveFrom: "2026-01-01", input: 7.5, output: 30 },
    { cachedInput: 2.5, effectiveFrom: "2026-06-01", input: 10, output: 40 },
  ],
  "gemini-3.5-pro": [{ cachedInput: 31.25, effectiveFrom: "2026-01-01", input: 125, output: 1000 }],
};

export class UnknownModelPriceError extends Error {
  readonly model: string;

  constructor(model: string) {
    super(`No price configured for model: ${model}`);
    this.model = model;
    this.name = "UnknownModelPriceError";
  }
}

export function priceFor(model: string, tokenClass: TokenClass, at: Date = new Date()): number {
  const entries = PRICE_TABLE[model];

  if (entries == null) {
    throw new UnknownModelPriceError(model);
  }

  const entry = entries
    .filter((candidate) => new Date(candidate.effectiveFrom).getTime() <= at.getTime())
    .toSorted(
      (left, right) =>
        new Date(left.effectiveFrom).getTime() - new Date(right.effectiveFrom).getTime(),
    )
    .at(-1);

  if (entry == null) {
    throw new UnknownModelPriceError(model);
  }

  return entry[tokenClass];
}

export function totalTokens(usage: TokenUsage): number {
  return usage.inputTokens + usage.cachedInputTokens + usage.outputTokens;
}

export function costCentsFor(model: string, usage: TokenUsage, at: Date = new Date()): bigint {
  const cents =
    (usage.inputTokens * priceFor(model, "input", at) +
      usage.cachedInputTokens * priceFor(model, "cachedInput", at) +
      usage.outputTokens * priceFor(model, "output", at)) /
    1_000_000;

  return BigInt(Math.ceil(cents));
}
