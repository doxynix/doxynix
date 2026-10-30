export const ACCESS_STATES = [
  "NO_SUBSCRIPTION",
  "PENDING",
  "ACTIVE",
  "GRACE",
  "SUSPENDED",
  "CANCELED",
  "REVIEW",
] as const;

export type AccessState = (typeof ACCESS_STATES)[number];

export const DEFAULT_ACCESS_STATE: AccessState = "NO_SUBSCRIPTION";

const KNOWN_STATUSES = new Set([
  "active",
  "canceled",
  "incomplete",
  "incomplete_expired",
  "past_due",
  "paused",
  "trialing",
  "unpaid",
]);

const TERMINAL_STATUSES = new Set(["canceled", "incomplete_expired"]);

// Section 5 of the plan. Same state is always allowed; REVIEW is reachable from anywhere and can
// only be left after a fresh canonical read, which is exactly what the worker performs.
const ALLOWED_TRANSITIONS: Record<AccessState, ReadonlySet<AccessState>> = {
  ACTIVE: new Set(["ACTIVE", "GRACE", "SUSPENDED", "CANCELED", "REVIEW"]),
  CANCELED: new Set(["CANCELED", "PENDING", "ACTIVE", "REVIEW"]),
  GRACE: new Set(["ACTIVE", "GRACE", "SUSPENDED", "CANCELED", "REVIEW"]),
  NO_SUBSCRIPTION: new Set(["NO_SUBSCRIPTION", "PENDING", "ACTIVE", "REVIEW"]),
  PENDING: new Set(["ACTIVE", "CANCELED", "PENDING", "REVIEW", "SUSPENDED"]),
  REVIEW: new Set(["ACTIVE", "CANCELED", "GRACE", "PENDING", "REVIEW", "SUSPENDED"]),
  SUSPENDED: new Set(["ACTIVE", "CANCELED", "REVIEW", "SUSPENDED"]),
};

export type RemoteSubscriptionSnapshot = {
  activatedAt: Date | null;
  graceEndsAt: Date | null;
  // Mirror status of this same Stripe subscription, null when it was never projected.
  previousStatus: null | string;
  priceKnown: boolean;
  status: string;
};

export type AccessDecision = {
  accessState: AccessState;
  reviewReason: null | string;
};

export function isAccessState(value: unknown): value is AccessState {
  return typeof value === "string" && (ACCESS_STATES as readonly string[]).includes(value);
}

export function hasAccess(state: AccessState): boolean {
  return state === "ACTIVE" || state === "GRACE";
}

export function isTerminalStatus(status: string): boolean {
  return TERMINAL_STATUSES.has(status);
}

function deriveAccessState(now: Date, remote: RemoteSubscriptionSnapshot): AccessDecision {
  if (!remote.priceKnown) {
    return { accessState: "REVIEW", reviewReason: "UNKNOWN_PRICE" };
  }

  if (!KNOWN_STATUSES.has(remote.status)) {
    return { accessState: "REVIEW", reviewReason: "UNKNOWN_STATUS" };
  }

  // Reviving a terminal Stripe subscription id is never a legitimate transition.
  if (
    remote.previousStatus != null &&
    isTerminalStatus(remote.previousStatus) &&
    !isTerminalStatus(remote.status)
  ) {
    return { accessState: "REVIEW", reviewReason: "REVIVED_TERMINAL_SUBSCRIPTION" };
  }

  if (isTerminalStatus(remote.status)) {
    return { accessState: "CANCELED", reviewReason: null };
  }

  if (remote.status === "active" || remote.status === "trialing") {
    // `active` alone is not proof of payment: the first paid invoice sets activatedAt.
    return remote.activatedAt == null
      ? { accessState: "PENDING", reviewReason: null }
      : { accessState: "ACTIVE", reviewReason: null };
  }

  if (remote.status === "incomplete") {
    return { accessState: "PENDING", reviewReason: null };
  }

  if (remote.status === "past_due") {
    if (remote.activatedAt == null) {
      return { accessState: "SUSPENDED", reviewReason: null };
    }

    // Fail closed: grace without a deadline is not grace.
    if (remote.graceEndsAt == null || remote.graceEndsAt.getTime() <= now.getTime()) {
      return { accessState: "SUSPENDED", reviewReason: null };
    }

    return { accessState: "GRACE", reviewReason: null };
  }

  // unpaid, paused.
  return { accessState: "SUSPENDED", reviewReason: null };
}

export function decideAccessState(input: {
  current: AccessState;
  now: Date;
  remote: RemoteSubscriptionSnapshot;
}): AccessDecision {
  const derived = deriveAccessState(input.now, input.remote);

  if (!ALLOWED_TRANSITIONS[input.current].has(derived.accessState)) {
    return {
      accessState: "REVIEW",
      reviewReason: `UNEXPECTED_TRANSITION:${input.current}->${derived.accessState}`,
    };
  }

  return derived;
}
