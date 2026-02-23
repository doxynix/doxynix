import { Check } from "lucide-react";
import { useTranslations } from "next-intl";

import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/core/button";

import { Link } from "@/i18n/routing";

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
    <section className="bg-landing-bg-light/20 border-y border-zinc-900/20 py-24">
      <div className="container mx-auto px-4">
        <h2 className="mb-16 text-center text-3xl font-bold md:text-5xl">
          {t("section_pricing_title_prefix")}{" "}
          <span className="text-muted-foreground">{t("section_pricing_title_highlight")}</span>
        </h2>
        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-8 md:grid-cols-3">
          {PLANS.map((plan) => (
            <div
              key={plan.name}
              className={cn(
                "relative flex flex-col rounded-2xl border p-8",
                plan.popular
                  ? "border-foreground/50 bg-foreground/10"
                  : "border-primary bg-landing-bg-light/40"
              )}
            >
              {plan.popular && (
                <div className="text-background bg-foreground absolute -top-3 left-1/2 -translate-x-1/2 rounded-full px-3 py-1 text-xs font-bold tracking-wide uppercase">
                  {t("section_pricing_badge_popular")}
                </div>
              )}
              <h3 className="mb-2 text-xl font-bold">{plan.name}</h3>
              <div className="mb-2 flex items-baseline gap-1">
                <span className="text-4xl font-bold">{plan.price}</span>
                <span className="text-muted-foreground">
                  {plan.price !== "Custom" ? t("section_pricing_interval") : ""}
                </span>
              </div>
              <p className="text-muted-foreground mb-6 text-sm">{plan.desc}</p>
              <Button
                asChild
                className={cn(
                  "mb-8 w-full cursor-pointer",
                  plan.popular && "bg-foreground hover:bg-accent-foreground text-background"
                )}
              >
                <Link href={plan.href}>{plan.cta}</Link>
              </Button>
              <ul className="flex-1 space-y-3">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm">
                    <Check className="mt-0.5 h-4 w-4 shrink-0" />
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
