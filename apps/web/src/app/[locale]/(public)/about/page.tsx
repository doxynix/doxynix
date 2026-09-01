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

const features = [
  {
    description:
      "Deep codebase analysis using advanced AI. Understands patterns, dependencies, and architecture automatically",
    icon: Sparkles,
    title: "AI-Powered Intelligence",
  },
  {
    description:
      "Generate comprehensive docs in minutes. Enterprise-grade performance without the enterprise complexity",
    icon: Zap,
    title: "Blazing Fast",
  },
  {
    description:
      "Read-only GitHub access. Your repositories stay secure. We never store or process sensitive data",
    icon: Shield,
    title: "Privacy by Design",
  },
  {
    description:
      "Professional, publication-ready documentation. Markdown, HTML, PDF – all perfectly formatted",
    icon: Network,
    title: "Beautifully Formatted",
  },
] as const satisfies readonly FeatureItem[];

export default async function AboutPage() {
  const tCommon = await getTranslations("Common");

  return (
    <div className="container mx-auto max-w-5xl animate-fade-in px-4 py-12 pt-24">
      <BackOrLinkButton
        className="mb-8 cursor-pointer"
        label={tCommon("back")}
        showIcon
        variant="link"
      />

      <div className="mb-20">
        <h1 className="mb-6 font-bold text-5xl text-foreground md:text-6xl">
          Built for developers, by developers
        </h1>
        <p className="max-w-2xl text-lg text-text-secondary">
          We believe beautiful documentation should be effortless. Doxynix combines AI intelligence
          with thoughtful design to transform how teams understand and maintain their code.
        </p>
      </div>

      <section className="mb-20 grid items-center gap-12 lg:grid-cols-2">
        <div className="flex flex-col gap-6">
          <h2 className="font-bold text-3xl">The problem we solve</h2>
          <div className="flex flex-col gap-4 text-text-secondary">
            <p>
              Legacy codebases are hard to understand. New team members struggle. Documentation
              falls behind. Critical knowledge lives only in developers&apos; heads.
            </p>
            <p>
              Traditional tools force you to write docs manually or suffer through auto-generated
              garbage. There has to be a better way.
            </p>
          </div>
        </div>
        <div className="rounded-2xl border bg-landing-bg-light/50 p-8">
          <div className="prose prose-sm dark:prose-invert flex max-w-none flex-col gap-4">
            <p className="text-text-secondary">
              Imagine onboarding a new developer to your project. They open your repository and
              find... nothing. No documentation. Just code. They spend hours deciphering the
              architecture, hunting for patterns, guessing at conventions.
            </p>
            <p className="text-text-secondary">
              This is exactly what Doxynix solves. We automatically generate comprehensive,
              AI-enhanced documentation that captures your codebase&apos;s essence instantly.
            </p>
            <p className="text-text-secondary">
              No manual writing. No stale docs. Just living, breathing documentation that evolves
              with your code.
            </p>
          </div>
        </div>
      </section>

      <section className="mb-20">
        <div className="mb-12">
          <h2 className="mb-3 font-bold text-3xl">Why choose Doxynix</h2>
          <p className="text-lg text-text-secondary">Four core principles that set us apart</p>
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
            <h2 className="font-bold text-4xl">Ready to transform your documentation?</h2>
            <p className="text-lg text-text-secondary">Join teams that ship better code, faster.</p>
          </div>
          <Link
            className="inline-flex items-center gap-3 rounded-xl bg-foreground px-8 py-4 font-semibold text-background transition-standard hover:opacity-90 active:scale-95"
            href="/auth"
          >
            Get Started Free
            <ArrowRight className="size-5" />
          </Link>
        </div>
      </section>
    </div>
  );
}
