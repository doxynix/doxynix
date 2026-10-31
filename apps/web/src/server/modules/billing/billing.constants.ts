// Re-exported so the SDK version keeps living in one place for the webhook endpoint and scripts.
export { STRIPE_API_VERSION } from "@/server/core/billing/stripe-version";

// Value of `BillingCustomer.provider` for Stripe rows; the column exists so a second provider
// does not need a schema change.
export const STRIPE_PROVIDER = "stripe";

// Shared by the task definition and the sweeper; the worker cannot import the task type without
// creating a cycle (the task imports the worker).
export const PROCESS_STRIPE_EVENT_TASK_ID = "billing-process-stripe-event";

// Return targets the Portal may send the owner back to; anything else is rejected.
export const PORTAL_RETURN_PATHS = [
  "/dashboard/settings/members",
  "/dashboard/settings/billing",
] as const;
