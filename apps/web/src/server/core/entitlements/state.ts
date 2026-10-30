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

export function isAccessState(value: unknown): value is AccessState {
  return typeof value === "string" && (ACCESS_STATES as readonly string[]).includes(value);
}

export function hasAccess(state: AccessState): boolean {
  return state === "ACTIVE" || state === "GRACE";
}
