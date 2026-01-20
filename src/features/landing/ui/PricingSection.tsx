import Link from "next/link";
import { Check } from "lucide-react";

import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";

const PLANS = [
  {
    name: "Hobby",
    href: "/auth",
    price: "$0",
    desc: "For open-source & side projects",
    features: ["Public Repositories", "1 Project", "Basic Markdown Export", "Community Support"],
    cta: "Start Free",
    popular: false,
  },
  {
    name: "Pro",
    href: "/auth",
    price: "$9",
    desc: "For professional developers",
    features: [
      "Private Repositories",
      "5 Projects",
      "GitHub Actions Integration",
      "Priority Support",
      "Bus Factor Analysis",
    ],
    cta: "Go Pro",
    popular: true,
  },
  {
    name: "Team",
    href: "/auth",
    price: "Custom",
    desc: "For engineering teams",
    features: [
      "Unlimited Projects",
      "SSO & SAML",
      "On-premise Deployment",
      "Custom LLM Context",
      "Audit Logs",
    ],
    cta: "Contact Sales",
    popular: false,
  },
];

export function PricingSection() {
  return (
    <section className="bg-landing-bg-light/20 relative z-10 border-y border-zinc-900/20 py-24">
      <div className="container mx-auto px-4">
        <h2 className="mb-16 text-center text-3xl font-bold md:text-5xl">
          Simple <span className="text-muted-foreground">Pricing</span>
        </h2>
        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-8 md:grid-cols-3">
          {PLANS.map((plan) => (
            <div
              key={plan.name}
              className={`relative flex flex-col rounded-2xl border p-8 ${plan.popular ? "border-foreground/50 bg-foreground/10" : "border-primary bg-landing-bg-light/40"}`}
            >
              {plan.popular && (
                <div className="text-background bg-foreground absolute -top-3 left-1/2 -translate-x-1/2 rounded-full px-3 py-1 text-xs font-bold tracking-wide uppercase">
                  Most Popular
                </div>
              )}
              <h3 className="mb-2 text-xl font-bold">{plan.name}</h3>
              <div className="mb-2 flex items-baseline gap-1">
                <span className="text-4xl font-bold">{plan.price}</span>
                <span className="text-muted-foreground">/mo</span>
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
