import { describe, expect, it } from "vitest";

import { activeStatKeys, FLOATING_CARD_STAT_KEYS } from "./floating-card-stats";

const ZERO_STATS = Object.fromEntries(FLOATING_CARD_STAT_KEYS.map((key) => [key, 0])) as Record<
  string,
  number
>;

describe("activeStatKeys", () => {
  it("includes configCount, which used to crash the card", () => {
    expect(activeStatKeys({ ...ZERO_STATS, configCount: 2 })).toEqual(["configCount"]);
  });

  it("drops zero values", () => {
    expect(activeStatKeys(ZERO_STATS)).toEqual([]);
  });

  it("drops pathCount and unknown server keys instead of throwing", () => {
    const stats = { ...ZERO_STATS, madeUpCount: 4, pathCount: 9 } as Record<string, number>;

    expect(activeStatKeys(stats)).toEqual([]);
  });

  it("returns keys in the declared order, independent of the payload order", () => {
    const stats = {
      ...ZERO_STATS,
      apiCount: 1,
      configCount: 1,
    } as Record<string, number>;

    expect(activeStatKeys(stats)).toEqual(["apiCount", "configCount"]);
  });
});
