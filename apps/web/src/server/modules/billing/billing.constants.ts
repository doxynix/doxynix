// The one place the Stripe API version lives: the SDK types describe only this version, and the
// webhook endpoint is configured for it in the Dashboard. Kept free of `server-only` so operator
// scripts can pin the same version.
export const STRIPE_API_VERSION = "2026-09-30.endive" as const;

// Value of `BillingCustomer.provider` for Stripe rows; the column exists so a second provider
// does not need a schema change.
export const STRIPE_PROVIDER = "stripe";
