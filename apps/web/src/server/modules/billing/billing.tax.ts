import type Stripe from "stripe";

import { IS_PROD } from "@/shared/config/env.flags";
import { STRIPE_TAX_REQUIRED_JURISDICTIONS } from "@/shared/config/env.server";

import { captureBillingAlert } from "@/server/core/billing/metrics";
import { type DbClient, prisma } from "@/server/core/db";

import { upsertBillingIssue } from "./billing.issues";
import { getStripeClient } from "./billing.stripe";

export type TaxPreflightResult = {
  activeJurisdictions: string[];
  missingJurisdictions: string[];
  settingsActive: boolean;
};

export function requiredJurisdictions(): string[] {
  return [...STRIPE_TAX_REQUIRED_JURISDICTIONS];
}

// Reads Stripe Tax configuration and records what blocks a paid launch. It never registers a
// jurisdiction and never falls back to manual tax rates.
export async function runTaxPreflight(
  db: DbClient = prisma,
  required: readonly string[] = requiredJurisdictions(),
): Promise<TaxPreflightResult> {
  const stripe = getStripeClient();
  const settings = await stripe.tax.settings.retrieve();
  const settingsActive = settings.status === "active" && settings.head_office != null;

  if (!settingsActive) {
    await upsertBillingIssue(db, {
      dedupeKey: "tax_settings_inactive",
      details: {
        missingFields: settings.status_details.pending?.missing_fields ?? [],
        status: settings.status,
      },
      kind: "TAX_SETTINGS_INACTIVE",
      severity: "CRITICAL",
      source: "stripe_tax",
    });
  }

  const activeJurisdictions: string[] = [];

  for await (const registration of stripe.tax.registrations.list({ status: "active" })) {
    activeJurisdictions.push(registration.country.toUpperCase());
  }

  if (required.length === 0 && IS_PROD) {
    await upsertBillingIssue(db, {
      dedupeKey: "tax_jurisdictions_not_configured",
      details: {},
      kind: "TAX_JURISDICTIONS_NOT_CONFIGURED",
      severity: "CRITICAL",
      source: "stripe_tax",
    });
  }

  const missingJurisdictions = required
    .map((country) => country.toUpperCase())
    .filter((country) => !activeJurisdictions.includes(country));

  for (const country of missingJurisdictions) {
    captureBillingAlert("TAX_REGISTRATION_MISSING", { country });

    await upsertBillingIssue(db, {
      dedupeKey: `tax_registration_missing:${country}`,
      details: { country },
      kind: "TAX_REGISTRATION_MISSING",
      severity: "CRITICAL",
      source: "stripe_tax",
    });
  }

  return { activeJurisdictions, missingJurisdictions, settingsActive };
}

// A zero-tax invoice on a taxable amount means the calculation did not collect anything, which in
// a sandbox without registrations looks exactly like success. Record it, do not treat it as one.
export async function recordTaxCollection(
  tx: DbClient,
  input: { invoice: Stripe.Invoice; workspaceId: string },
): Promise<void> {
  const { invoice } = input;

  if (invoice.total <= 0 || invoice.total_taxes == null) {
    return;
  }

  if (invoice.automatic_tax.status === "requires_location_inputs") {
    return;
  }

  const taxAmount = invoice.total_taxes.reduce((sum, tax) => sum + tax.amount, 0);

  if (taxAmount === 0) {
    await upsertBillingIssue(tx, {
      dedupeKey: `tax_not_collected:${invoice.id}`,
      details: { total: invoice.total },
      kind: "TAX_NOT_COLLECTED",
      severity: "CRITICAL",
      source: "stripe_tax",
      stripeObjectId: invoice.id,
      workspaceId: input.workspaceId,
    });
  }
}
