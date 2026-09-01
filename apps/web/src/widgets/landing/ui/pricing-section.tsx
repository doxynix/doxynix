"use client";

import { Check } from "lucide-react";
import { useTranslations } from "next-intl";
import posthog from "posthog-js";

import { Link } from "@/shared/i18n/navigation";
import { cn } from "@/shared/lib/cn";
import { AppButton } from "@/shared/ui/core/button";

export function PricingSection() {
  const t = useTranslations("Landing");

  const PLANS = [
    {
      cta: t("section_pricing_plan_hobby_cta"),
      desc: t("section_pricing_plan_hobby_desc"),
      features: [
        t("section_pricing_plan_hobby_f1"),
        t("section_pricing_plan_hobby_f2"),
        t("section_pricing_plan_hobby_f3"),
        t("section_pricing_plan_hobby_f4"),
      ],
      href: "/auth",
      name: t("section_pricing_plan_hobby_name"),
      popular: false,
      price: "$0",
    },
    {
      cta: t("section_pricing_plan_pro_cta"),
      desc: t("section_pricing_plan_pro_desc"),
      features: [
        t("section_pricing_plan_pro_f1"),
        t("section_pricing_plan_pro_f2"),
        t("section_pricing_plan_pro_f3"),
        t("section_pricing_plan_pro_f4"),
        t("section_pricing_plan_pro_f5"),
      ],
      href: "/auth",
      name: t("section_pricing_plan_pro_name"),
      popular: true,
      price: "$9",
    },
    {
      cta: t("section_pricing_plan_team_cta"),
      desc: t("section_pricing_plan_team_desc"),
      features: [
        t("section_pricing_plan_team_f1"),
        t("section_pricing_plan_team_f2"),
        t("section_pricing_plan_team_f3"),
        t("section_pricing_plan_team_f4"),
        t("section_pricing_plan_team_f5"),
      ],
      href: "/auth",
      name: t("section_pricing_plan_team_name"),
      popular: false,
      price: "Custom",
    },
  ];

  return (
    <section className="border-border border-y bg-landing-bg-light/20 py-24">
      <div className="container mx-auto px-4">
        <h2 className="mb-16 text-center font-bold text-3xl md:text-5xl">
          {t("section_pricing_title_prefix")}{" "}
          <span className="text-muted-foreground">{t("section_pricing_title_highlight")}</span>
        </h2>
        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-8 md:grid-cols-3">
          {PLANS.map((plan) => (
            <div
              className={cn(
                "relative flex flex-col rounded-2xl border p-8",
                plan.popular
                  ? "border-foreground/50 bg-foreground/10"
                  : "border-border bg-landing-bg-light/40",
              )}
              key={plan.name}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-foreground px-3 py-1 font-bold text-background text-xs uppercase tracking-wide">
                  {t("section_pricing_badge_popular")}
                </div>
              )}
              <h3 className="mb-2 font-bold text-xl">{plan.name}</h3>
              <div className="mb-2 flex items-baseline gap-1">
                <span className="font-bold text-4xl">{plan.price}</span>
                <span className="text-muted-foreground">
                  {plan.price === "Custom" ? "" : t("section_pricing_interval")}
                </span>
              </div>
              <p className="mb-6 text-muted-foreground text-sm">{plan.desc}</p>
              <AppButton
                asChild
                className={cn(
                  "mb-8 w-full cursor-pointer",
                  plan.popular && "bg-foreground text-background hover:bg-accent-foreground",
                )}
                onClick={() =>
                  posthog.capture("pricing_plan_clicked", {
                    is_popular: plan.popular,
                    plan_id: plan.href === "/auth" ? "auth_entry" : "unknown",
                    plan_name_display: plan.name,
                    plan_price_display: plan.price,
                    plan_tier: plan.popular ? "pro" : "other",
                  })
                }
              >
                <Link href={plan.href}>{plan.cta}</Link>
              </AppButton>
              <ul className="flex flex-1 flex-col gap-3">
                {plan.features.map((f) => (
                  <li className="flex items-start gap-2 text-sm" key={f}>
                    <Check className="mt-0.5" />
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
