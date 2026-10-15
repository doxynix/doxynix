import { hashKey } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";

import { urlStateFromSearchParams } from "@/shared/lib/url-state";

import { dashboardParsers, dashboardRangeInput } from "./dashboard-parsers";

// The prefetch pattern rests on an invariant nothing in the type system enforces: the key the server
// builds must hash identically to the key the client builds. When it does not, the prefetch still
// runs and still succeeds — it just populates a cache entry nobody reads, with no error anywhere.
// These tests are the only guard on that.
describe("dashboard prefetch input", () => {
  const hash = (input: ReturnType<typeof dashboardRangeInput>) =>
    hashKey([["analytics", "getDashboardStats"], { input, type: "query" }]);

  it("matches the client input on a clean URL", () => {
    // What `useDashboardStats()` builds: nuqs applies the parser defaults and the component maps
    // null to undefined.
    const client = dashboardRangeInput({
      from: null,
      period: dashboardParsers.period.defaultValue,
      to: null,
    });

    // What the RSC builds from an absent searchParams.
    const server = dashboardRangeInput(urlStateFromSearchParams(dashboardParsers, {}));

    expect(hash(server)).toBe(hash(client));
  });

  it("matches the client input on a filtered URL", () => {
    const from = new Date("2026-01-02T00:00:00.000Z");
    const to = new Date("2026-02-03T00:00:00.000Z");
    const query = { from: from.toISOString(), period: "7d", to: to.toISOString() };

    const server = dashboardRangeInput(urlStateFromSearchParams(dashboardParsers, query));
    const client = dashboardRangeInput(urlStateFromSearchParams(dashboardParsers, query));

    expect(server).toEqual({ from, period: "7d", to });
    expect(hash(server)).toBe(hash(client));
  });

  it("does not treat null as undefined, because the two hash differently", () => {
    // Guards the normalisation every server-side builder depends on.
    expect(hashKey([{ a: null }])).not.toBe(hashKey([{ a: undefined }]));
    expect(dashboardRangeInput({ from: null }).from).toBeUndefined();
  });
});
