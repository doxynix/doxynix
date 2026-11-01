import { AccessState, AccessStateSchema } from "@doxynix/shared";

// Column and code use the same generated enum, so a missing state cannot drift between them.
export const ACCESS_STATES = Object.values(AccessState) as [AccessState, ...AccessState[]];

export const DEFAULT_ACCESS_STATE = AccessState.NO_SUBSCRIPTION;

export function isAccessState(value: unknown): value is AccessState {
  return AccessStateSchema.safeParse(value).success;
}

export function hasAccess(state: AccessState): boolean {
  return state === AccessState.ACTIVE || state === AccessState.GRACE;
}
