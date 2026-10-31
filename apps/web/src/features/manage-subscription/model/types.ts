import type { RouterOutput } from "@/shared/api/trpc";

export type BillingState = RouterOutput["billing"]["getState"];
export type BillingEntitlement = NonNullable<BillingState["entitlement"]>;
export type BillingSubscription = NonNullable<BillingState["subscription"]>;
export type BillingAccessState = BillingEntitlement["accessState"];
