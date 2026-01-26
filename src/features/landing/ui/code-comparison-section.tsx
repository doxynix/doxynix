import { getTranslations } from "next-intl/server";

import { highlightCode } from "@/shared/lib/shiki";
import { CodeComparison } from "@/shared/ui/kit/code-comparison";

export async function CodeComparisonSection() {
  const t = await getTranslations("Landing");

  const [badDark, badLight, goodDark, goodLight] = await Promise.all([
    highlightCode(BAD_CODE, "typescript", "dark"),
    highlightCode(BAD_CODE, "typescript", "light"),
    highlightCode(GOOD_CODE, "typescript", "dark"),
    highlightCode(GOOD_CODE, "typescript", "light"),
  ]);
  return (
    <section className="bg-landing-bg-light/20 z-10 border-y border-white/5 py-32">
      <div className="container mx-auto px-4">
        <h2 className="mb-16 text-center text-3xl font-bold md:text-5xl">
          {t("section_code_title_prefix")}{" "}
          <span className="text-muted-foreground">{t("section_code_title_highlight")}</span>
        </h2>
        <div className="border-primary mx-auto max-w-6xl overflow-hidden rounded-xl border shadow-2xl">
          <CodeComparison
            filename="services/billing.ts"
            beforeHtmlDark={badDark}
            beforeHtmlLight={badLight}
            afterHtmlDark={goodDark}
            afterHtmlLight={goodLight}
            badCode={BAD_CODE}
            goodCode={GOOD_CODE}
          />
        </div>
      </div>
    </section>
  );
}

const BAD_CODE = `export async function processSub(uId: string, plan: string) {
  const user = await db.user.findById(uId);

  if (!user.isActive) throw new Error("403");
  if (user.sub === plan) return null;

  const price = PRICING[plan];

  // Charge the user
  await stripe.charges.create({
    amount: price * 100,
    currency: 'usd',
    customer: user.stripeId
  });

  await db.user.update(uId, { sub: plan, status: 'active' });
  await email.sendWelcome(user.email, plan);

  return true;
}`;

const GOOD_CODE = `/**
 * Upgrades user subscription and handles payment processing.
 *
 * @description
 * 1. Verifies user status (must be active).
 * 2. Deduplicates requests (returns null if already on plan).
 * 3. Charges card via Stripe and updates local DB.
 *
 * @param {string} uId - Internal user UUID.
 * @param {string} plan - Target plan ID (e.g., 'PRO_YEARLY').
 * @throws {Error} "403" if user is suspended/inactive.
 * @returns {Promise<boolean|null>} True on success, null if no change needed.
 *
 * @example
 * try {
 *   await processSub("user_123", "ENTERPRISE");
 * } catch (err) {
 *   logger.error("Payment failed", err);
 * }
 */
export async function processSub(uId: string, plan: string) {
  const user = await db.user.findById(uId);

  if (!user.isActive) throw new Error("403"); // User suspended
  if (user.sub === plan) return null; // Already subscribed

  const price = PRICING[plan];

  // Charge the user
  await stripe.charges.create({
    amount: price * 100, // Convert to cents
    currency: 'usd',
    customer: user.stripeId
  });

  // Update db and send email
  await db.user.update(uId, { sub: plan, status: 'active' });
  await email.sendWelcome(user.email, plan);

  return true;
}`;
