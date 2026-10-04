import { describe, expect, it } from "vitest";

import { poolQueueSnapshot } from "./db";

describe("poolQueueSnapshot", () => {
  it("returns undefined when nothing is queueing", () => {
    expect(poolQueueSnapshot({ idleCount: 4, totalCount: 10, waitingCount: 0 })).toBeUndefined();
  });

  it("reports counters when requests are queueing", () => {
    expect(poolQueueSnapshot({ idleCount: 0, totalCount: 10, waitingCount: 7 })).toEqual({
      poolIdle: 0,
      poolTotal: 10,
      poolWaiting: 7,
    });
  });

  it("reports counters even when the pool has idle connections", () => {
    expect(poolQueueSnapshot({ idleCount: 3, totalCount: 10, waitingCount: 1 })).toEqual({
      poolIdle: 3,
      poolTotal: 10,
      poolWaiting: 1,
    });
  });
});
