import * as Sentry from "@sentry/nextjs";

import { appLogger } from "@/server/core/app-logger";

// Section 15 counters. Labels are ids/types/state only: never payloads, emails or amounts.
export type BillingMetric =
  | "billing_dlq_total"
  | "billing_entitlement_total"
  | "billing_event_failures_total"
  | "billing_reconciliation_duration_seconds"
  | "billing_reconciliation_last_success_timestamp"
  | "billing_reconciliation_mismatches_total"
  | "billing_replay_total"
  | "billing_subscription_transition_total"
  | "billing_webhook_lag_seconds"
  | "billing_webhook_received_total";

export type BillingAlert =
  | "DISPUTE"
  | "DLQ"
  | "EARLY_FRAUD_WARNING"
  | "INVALID_SIGNATURE"
  | "PAYLOAD_HASH_MISMATCH"
  | "RECONCILIATION_FAILED"
  | "RECONCILIATION_STALE"
  | "TAX_REGISTRATION_MISSING"
  | "UNOWNED_STRIPE_OBJECT";

type MetricLabels = Record<string, boolean | number | string>;

export function recordBillingMetric(
  metric: BillingMetric,
  value: number,
  labels: MetricLabels = {},
): void {
  appLogger.info({ labels, metric, msg: "billing.metric", type: "billing.metric", value });
}

export function captureBillingAlert(alert: BillingAlert, context: MetricLabels = {}): void {
  Sentry.captureMessage(`billing alert: ${alert}`, {
    extra: context,
    level: "error",
    tags: { alert },
  });
}
