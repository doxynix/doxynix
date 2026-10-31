// Stripe objects that belong to one customer must not be projected in parallel by two workers.
// The key is derived from the event payload only, so the webhook, the admin replay and the sweeper
// all produce the same value for the same owner.
export function ownershipKeyForObject(object: unknown): string {
  if (typeof object === "object" && object !== null) {
    if ("customer" in object && typeof object.customer === "string") {
      return `customer:${object.customer}`;
    }

    if ("subscription" in object && typeof object.subscription === "string") {
      return `subscription:${object.subscription}`;
    }

    if ("id" in object && typeof object.id === "string") {
      return `object:${object.id}`;
    }
  }

  return "owner:unknown";
}

export function ownershipKeyFromPayload(payload: unknown): string {
  if (typeof payload === "object" && payload !== null && "data" in payload) {
    const { data } = payload as { data?: unknown };

    if (typeof data === "object" && data !== null && "object" in data) {
      return ownershipKeyForObject((data as { object?: unknown }).object);
    }
  }

  return "owner:unknown";
}
