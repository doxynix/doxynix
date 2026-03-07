import { ArrowRight, Network, Shield, Sparkles, Zap } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { createMetadata } from "@/shared/lib/metadata";
import { BackOrLinkButton } from "@/shared/ui/kit/back-or-link-button";
import { Link } from "@/i18n/routing";
import React from "react";

// export const runtime = "edge";

export const generateMetadata = createMetadata("about_title", "about_desc");

type FeatureItem = { description: string; icon: React.ComponentType<{className: string}>; title: string };

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
]as const satisfies readonly FeatureItem[];

export default async function AboutPage() {
  const tCommon = await getTranslations("Common");

  return (
    <div className="animate-fade-in container mx-auto max-w-5xl px-4 py-12 pt-24">
      <BackOrLinkButton
        showIcon
        label={tCommon("back")}
        variant="link"
        className="mb-8 cursor-pointer"
      />

      <div className="mb-20">
        <h1 className="text-foreground mb-6 text-5xl font-bold md:text-6xl">
          Built for developers, by developers
        </h1>
        <p className="text-text-secondary max-w-2xl text-lg">
          We believe beautiful documentation should be effortless. Doxynix combines AI intelligence
          with thoughtful design to transform how teams understand and maintain their code.
        </p>
      </div>

      <section className="mb-20 grid items-center gap-12 lg:grid-cols-2">
        <div className="space-y-6">
          <h2 className="text-3xl font-bold">The problem we solve</h2>
          <div className="text-text-secondary space-y-4">
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
        <div className="bg-landing-bg-light/50 rounded-2xl border p-8">
          <div className="prose prose-sm dark:prose-invert max-w-none space-y-4">
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
          <h2 className="mb-3 text-3xl font-bold">Why choose Doxynix</h2>
          <p className="text-text-secondary text-lg">Four core principles that set us apart</p>
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="bg-landing-bg-light/50 rounded-2xl border p-8 transition-all duration-300"
            >
              <div className="space-y-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl border transition-colors">
                  <feature.icon className="text-foreground/60 h-6 w-6" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-foreground text-lg font-semibold">{feature.title}</h3>
                  <p className="text-text-secondary text-sm">{feature.description}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-landing-bg-light/50 mb-20 rounded-2xl border">
        <div className="space-y-8 p-12 text-center md:p-16">
          <div className="space-y-3">
            <h2 className="text-4xl font-bold">Ready to transform your documentation?</h2>
            <p className="text-text-secondary text-lg">Join teams that ship better code, faster.</p>
          </div>
          <Link
            href="/auth"
            className="bg-foreground text-background inline-flex items-center gap-3 rounded-xl px-8 py-4 font-semibold transition-all hover:opacity-90 active:scale-95"
          >
            Get Started Free
            <ArrowRight className="h-5 w-5" />
          </Link>
        </div>
      </section>
    </div>
  );
}
