import { afterEach, describe, expect, it } from "vitest";

import { poolQueueSnapshot } from "./db";

const globalForPool = globalThis as unknown as { pgPoolConnects?: number };

describe("poolQueueSnapshot", () => {
  afterEach(() => {
    globalForPool.pgPoolConnects = 0;
  });

  it("reports zero connects before any connection is opened", () => {
    globalForPool.pgPoolConnects = 0;

    expect(poolQueueSnapshot({ idleCount: 4, totalCount: 0, waitingCount: 0 })).toEqual({
      poolConnects: 0,
      poolIdle: 4,
      poolTotal: 0,
      poolWaiting: 0,
    });
  });

  it("surfaces the connect count so a cold start is distinguishable", () => {
    globalForPool.pgPoolConnects = 1;

    expect(poolQueueSnapshot({ idleCount: 1, totalCount: 1, waitingCount: 0 })).toEqual({
      poolConnects: 1,
      poolIdle: 1,
      poolTotal: 1,
      poolWaiting: 0,
    });
  });

  it("reports queue depth when requests are waiting", () => {
    globalForPool.pgPoolConnects = 3;

    expect(poolQueueSnapshot({ idleCount: 0, totalCount: 10, waitingCount: 7 })).toEqual({
      poolConnects: 3,
      poolIdle: 0,
      poolTotal: 10,
      poolWaiting: 7,
    });
  });

  it("always returns a snapshot, since a cold start never queues", () => {
    globalForPool.pgPoolConnects = 1;

    expect(
      poolQueueSnapshot({ idleCount: 3, totalCount: 10, waitingCount: 0 }),
    ).not.toBeUndefined();
  });
});
