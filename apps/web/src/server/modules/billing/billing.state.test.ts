import { describe, expect, it } from "vitest";

import {
  type AccessState,
  decideAccessState,
  hasAccess,
  type RemoteSubscriptionSnapshot,
} from "./billing.state";

const NOW = new Date("2026-10-30T12:00:00.000Z");
const FUTURE = new Date("2026-11-05T12:00:00.000Z");
const PAST = new Date("2026-10-29T12:00:00.000Z");

function remote(overrides: Partial<RemoteSubscriptionSnapshot> = {}): RemoteSubscriptionSnapshot {
  return {
    activatedAt: NOW,
    graceEndsAt: null,
    previousStatus: "active",
    priceKnown: true,
    status: "active",
    ...overrides,
  };
}

type StatusCase = {
  current: AccessState;
  expected: AccessState;
  name: string;
  reason?: string;
  remote: Partial<RemoteSubscriptionSnapshot>;
};

const STATUS_CASES: Array<StatusCase> = [
  {
    current: "PENDING",
    expected: "ACTIVE",
    name: "active with a recorded activation",
    remote: { status: "active" },
  },
  {
    current: "PENDING",
    expected: "ACTIVE",
    name: "trialing with a recorded activation",
    remote: { status: "trialing" },
  },
  {
    current: "NO_SUBSCRIPTION",
    expected: "PENDING",
    name: "active without a paid invoice",
    remote: { activatedAt: null, previousStatus: null, status: "active" },
  },
  {
    current: "NO_SUBSCRIPTION",
    expected: "PENDING",
    name: "incomplete",
    remote: { activatedAt: null, previousStatus: null, status: "incomplete" },
  },
  {
    current: "ACTIVE",
    expected: "GRACE",
    name: "past_due inside grace",
    remote: { graceEndsAt: FUTURE, status: "past_due" },
  },
  {
    current: "ACTIVE",
    expected: "SUSPENDED",
    name: "past_due without a grace deadline",
    remote: { graceEndsAt: null, status: "past_due" },
  },
  {
    current: "GRACE",
    expected: "SUSPENDED",
    name: "past_due with an expired grace",
    remote: { graceEndsAt: PAST, status: "past_due" },
  },
  {
    current: "PENDING",
    expected: "SUSPENDED",
    name: "past_due before any activation",
    remote: { activatedAt: null, graceEndsAt: FUTURE, status: "past_due" },
  },
  {
    current: "ACTIVE",
    expected: "SUSPENDED",
    name: "unpaid",
    remote: { status: "unpaid" },
  },
  {
    current: "ACTIVE",
    expected: "SUSPENDED",
    name: "paused",
    remote: { status: "paused" },
  },
  {
    current: "ACTIVE",
    expected: "CANCELED",
    name: "canceled",
    remote: { status: "canceled" },
  },
  {
    current: "PENDING",
    expected: "CANCELED",
    name: "incomplete_expired",
    remote: { status: "incomplete_expired" },
  },
  {
    current: "ACTIVE",
    expected: "REVIEW",
    name: "an unknown Stripe status",
    reason: "UNKNOWN_STATUS",
    remote: { status: "some_future_status" },
  },
  {
    current: "ACTIVE",
    expected: "REVIEW",
    name: "an unknown price",
    reason: "UNKNOWN_PRICE",
    remote: { priceKnown: false },
  },
];

describe("decideAccessState", () => {
  it.each(STATUS_CASES)("maps $name", ({ current, expected, reason, remote: snapshot }) => {
    const decision = decideAccessState({ current, now: NOW, remote: remote(snapshot) });

    expect(decision.accessState).toBe(expected);
    expect(decision.reviewReason).toBe(reason ?? null);
  });

  it("treats a revived terminal subscription id as REVIEW", () => {
    const decision = decideAccessState({
      current: "CANCELED",
      now: NOW,
      remote: remote({ previousStatus: "canceled", status: "active" }),
    });

    expect(decision.accessState).toBe("REVIEW");
    expect(decision.reviewReason).toBe("REVIVED_TERMINAL_SUBSCRIPTION");
  });

  it("allows a new subscription id after a cancellation", () => {
    const decision = decideAccessState({
      current: "CANCELED",
      now: NOW,
      remote: remote({ activatedAt: null, previousStatus: null, status: "active" }),
    });

    expect(decision.accessState).toBe("PENDING");
  });

  it("rejects a transition the table does not allow", () => {
    const decision = decideAccessState({
      current: "SUSPENDED",
      now: NOW,
      remote: remote({ graceEndsAt: FUTURE, status: "past_due" }),
    });

    expect(decision.accessState).toBe("REVIEW");
    expect(decision.reviewReason).toBe("UNEXPECTED_TRANSITION:SUSPENDED->GRACE");
  });

  it("rejects NO_SUBSCRIPTION to SUSPENDED", () => {
    const decision = decideAccessState({
      current: "NO_SUBSCRIPTION",
      now: NOW,
      remote: remote({ activatedAt: null, previousStatus: null, status: "past_due" }),
    });

    expect(decision.accessState).toBe("REVIEW");
  });

  it("lets REVIEW leave only through a valid canonical read", () => {
    const decision = decideAccessState({
      current: "REVIEW",
      now: NOW,
      remote: remote({ status: "active" }),
    });

    expect(decision.accessState).toBe("ACTIVE");
  });
});

describe("hasAccess", () => {
  const expectations: Array<[AccessState, boolean]> = [
    ["ACTIVE", true],
    ["GRACE", true],
    ["CANCELED", false],
    ["NO_SUBSCRIPTION", false],
    ["PENDING", false],
    ["REVIEW", false],
    ["SUSPENDED", false],
  ];

  it.each(expectations)("%s -> %s", (state, expected) => {
    expect(hasAccess(state)).toBe(expected);
  });
});
