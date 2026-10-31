// Free of `server-only` on purpose: operator scripts and the Stripe sandbox harness pin the same
// version, and importing the client module would throw there. The SDK types describe only this one.
export const STRIPE_API_VERSION = "2026-09-30.endive" as const;
