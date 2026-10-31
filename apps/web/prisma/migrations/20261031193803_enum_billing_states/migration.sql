-- Closed internal state machines become Postgres enums; provider-specific values stay TEXT.

CREATE TYPE "AccessState" AS ENUM (
  'NO_SUBSCRIPTION',
  'PENDING',
  'ACTIVE',
  'GRACE',
  'SUSPENDED',
  'CANCELED',
  'REVIEW'
);

ALTER TABLE "workspace_entitlements" ALTER COLUMN "access_state" DROP DEFAULT;
ALTER TABLE "workspace_entitlements"
  ALTER COLUMN "access_state" TYPE "AccessState" USING "access_state"::"AccessState";
ALTER TABLE "workspace_entitlements" ALTER COLUMN "access_state" SET DEFAULT 'NO_SUBSCRIPTION';

CREATE TYPE "BillingEventStatus" AS ENUM (
  'RECEIVED',
  'ENQUEUED',
  'PROCESSING',
  'PROCESSED',
  'DEAD_LETTER'
);

ALTER TABLE "billing_events" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "billing_events"
  ALTER COLUMN "status" TYPE "BillingEventStatus" USING "status"::"BillingEventStatus";
ALTER TABLE "billing_events" ALTER COLUMN "status" SET DEFAULT 'RECEIVED';

CREATE TYPE "BillingOperationStatus" AS ENUM ('STARTED', 'COMPLETED', 'FAILED');

ALTER TABLE "billing_operations"
  ALTER COLUMN "status" TYPE "BillingOperationStatus" USING "status"::"BillingOperationStatus";

CREATE TYPE "BillingReconciliationStatus" AS ENUM ('RUNNING', 'SUCCESS', 'FAILED');

ALTER TABLE "billing_reconciliation_runs"
  ALTER COLUMN "status" TYPE "BillingReconciliationStatus" USING "status"::"BillingReconciliationStatus";

CREATE TYPE "BillingIssueStatus" AS ENUM ('OPEN', 'RESOLVED');

ALTER TABLE "billing_issues" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "billing_issues"
  ALTER COLUMN "status" TYPE "BillingIssueStatus" USING "status"::"BillingIssueStatus";
ALTER TABLE "billing_issues" ALTER COLUMN "status" SET DEFAULT 'OPEN';

CREATE TYPE "BillingIssueSeverity" AS ENUM ('CRITICAL', 'WARNING', 'INFO');

ALTER TABLE "billing_issues"
  ALTER COLUMN "severity" TYPE "BillingIssueSeverity" USING "severity"::"BillingIssueSeverity";

CREATE TYPE "UsageEventKind" AS ENUM (
  'ANALYSIS',
  'ANALYSIS_RELEASE',
  'CACHE_HIT',
  'RESERVE',
  'SETTLE'
);

ALTER TABLE "usage_events" ALTER COLUMN "kind" DROP DEFAULT;
ALTER TABLE "usage_events"
  ALTER COLUMN "kind" TYPE "UsageEventKind" USING "kind"::"UsageEventKind";
