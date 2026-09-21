import type { ComponentType } from "react";
import { ArrowRight, Network, Shield, Sparkles, Zap } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { Link } from "@/shared/i18n/navigation";
import { createMetadata } from "@/shared/lib/metadata";
import { BackOrLinkButton } from "@/shared/ui/kit/back-or-link-button";

export const generateMetadata = createMetadata("about_title", "about_desc");

type FeatureItem = {
  description: string;
  icon: ComponentType<{ className?: string }>;
  title: string;
};

export default async function AboutPage() {
  const tCommon = await getTranslations("Common");
  const t = await getTranslations("About");

  const features = [
    {
      description: t("feature_ai_desc"),
      icon: Sparkles,
      title: t("feature_ai_title"),
    },
    {
      description: t("feature_speed_desc"),
      icon: Zap,
      title: t("feature_speed_title"),
    },
    {
      description: t("feature_privacy_desc"),
      icon: Shield,
      title: t("feature_privacy_title"),
    },
    {
      description: t("feature_format_desc"),
      icon: Network,
      title: t("feature_format_title"),
    },
  ] as const satisfies readonly FeatureItem[];

  return (
    <div className="container mx-auto max-w-5xl animate-fade-in px-4 py-12 pt-24">
      <BackOrLinkButton
        className="mb-8 cursor-pointer"
        label={tCommon("back")}
        showIcon
        variant="link"
      />

      <div className="mb-20">
        <h1 className="mb-6 font-bold text-5xl text-foreground md:text-6xl">{t("hero_title")}</h1>
        <p className="max-w-2xl text-lg text-text-secondary">{t("hero_desc")}</p>
      </div>

      <section className="mb-20 grid items-center gap-12 lg:grid-cols-2">
        <div className="flex flex-col gap-6">
          <h2 className="font-bold text-3xl">{t("problem_title")}</h2>
          <div className="flex flex-col gap-4 text-text-secondary">
            <p>{t("problem_desc_1")}</p>
            <p>{t("problem_desc_2")}</p>
          </div>
        </div>
        <div className="rounded-2xl border bg-landing-bg-light/50 p-8">
          <div className="prose prose-sm dark:prose-invert flex max-w-none flex-col gap-4">
            <p className="text-text-secondary">{t("problem_imagine")}</p>
            <p className="text-text-secondary">{t("problem_solution")}</p>
            <p className="text-text-secondary">{t("problem_result")}</p>
          </div>
        </div>
      </section>

      <section className="mb-20">
        <div className="mb-12">
          <h2 className="mb-3 font-bold text-3xl">{t("why_title")}</h2>
          <p className="text-lg text-text-secondary">{t("why_desc")}</p>
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          {features.map((feature) => (
            <div
              className="rounded-2xl border bg-landing-bg-light/50 p-8 transition-standard"
              key={feature.title}
            >
              <div className="flex flex-col gap-4">
                <div className="flex size-12 items-center justify-center rounded-xl border transition-colors">
                  <feature.icon className="size-6 text-foreground" />
                </div>
                <div className="flex flex-col gap-2">
                  <h3 className="font-semibold text-foreground text-lg">{feature.title}</h3>
                  <p className="text-sm text-text-secondary">{feature.description}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-20 rounded-2xl border bg-landing-bg-light/50">
        <div className="flex flex-col gap-8 p-12 text-center md:p-16">
          <div className="flex flex-col gap-3">
            <h2 className="font-bold text-4xl">{t("cta_title")}</h2>
            <p className="text-lg text-text-secondary">{t("cta_desc")}</p>
          </div>
          <Link
            className="inline-flex items-center gap-3 rounded-xl bg-foreground px-8 py-4 font-semibold text-background transition-standard hover:opacity-90 active:scale-95"
            href="/auth"
          >
            {tCommon("get_started_free")}
            <ArrowRight className="size-5" />
          </Link>
        </div>
      </section>
    </div>
  );
}
