import type { ComponentType } from "react";
import { BookOpen, Mail, MessageSquare, MoveLeft } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { createMetadata } from "@/shared/lib/metadata";
import { Accordion } from "@/shared/ui/core/accordion";
import { GitHubIcon } from "@/shared/ui/icons/github-icon";
import { AccordionListItem } from "@/shared/ui/kit/accordion-list-item";
import { BackOrLinkButton } from "@/shared/ui/kit/back-or-link-button";

// export const runtime = "edge";

export const generateMetadata = createMetadata("support_title", "support_desc");

type SupportChannel = {
  action: string;
  description: string;
  external?: boolean;
  href: string;
  icon: ComponentType<{ className?: string }>;
  title: string;
};

const supportChannels = [
  {
    action: "support@doxynix.com",
    description: "Direct line to our support team. We typically respond within 24 hours",
    href: "mailto:support@doxynix.com",
    icon: Mail,
    title: "Email Support",
  },
  {
    action: "View Repository",
    description: "Report bugs, request features, or contribute to open discussions",
    external: true,
    href: "https://github.com/doxynix/doxynix/issues",
    icon: GitHubIcon,
    title: "GitHub Issues",
  },
  {
    action: "Join Server",
    description: "Connect with other developers, share insights, and get instant help",
    external: true,
    href: "https://discord.gg/doxynix",
    icon: MessageSquare,
    title: "Community Discord",
  },
  {
    action: "Read Docs",
    description: "Comprehensive guides, tutorials, and best practices for getting started",
    external: true,
    href: "https://docs.doxynix.space",
    icon: BookOpen,
    title: "Documentation",
  },
] satisfies SupportChannel[];

type FaqItem = { a: string; q: string; value: string };

const faqItems = [
  {
    a: "Most repositories complete analysis in 2-5 minutes depending on size and complexity. Enterprise repos with 100K+ files may take up to 10-15 minutes. You'll receive real-time progress updates throughout the process.",
    q: "How long does repository analysis take?",
    value: "item-1",
  },
  {
    a: "No. We use read-only GitHub API access and process data on-the-fly. Your repository contents are never stored on our servers. We only retain analysis metadata for performance optimization, which you can delete anytime.",
    q: "Is my code stored or logged anywhere?",
    value: "item-2",
  },
  {
    a: "Absolutely. We support private repos with the same read-only access model. Simply authorize the required permissions during setup and we handle the rest seamlessly.",
    q: "Do you support private repositories?",
    value: "item-3",
  },
  {
    a: "We support Markdown (default with GitHub formatting), HTML (for web viewing), and PDF (for sharing). Each supports customizable styling, themes, and layouts to match your brand.",
    q: "What documentation formats are supported?",
    value: "item-4",
  },
  {
    a: "Yes! We provide GitHub Actions integration, webhooks, and API access. You can automate documentation generation on every commit if you prefer.",
    q: "Can I integrate Doxynix with my CI/CD pipeline?",
    value: "item-5",
  },
] as const satisfies readonly FaqItem[];

export default async function SupportPage() {
  const tCommon = await getTranslations("Common");

  return (
    <div className="animate-fade-in relative container mx-auto min-h-dvh max-w-5xl overflow-hidden px-4 py-12 pt-24">
      <BackOrLinkButton
        showIcon
        label={tCommon("back")}
        variant="link"
        className="mb-8 cursor-pointer"
      />

      <div className="mb-20">
        <h1 className="text-foreground mb-6 text-5xl font-bold md:text-6xl">
          We&apos;re here to help
        </h1>
        <p className="text-text-secondary max-w-2xl text-lg">
          Multiple ways to get support, advice, and connect with our team. Choose the channel that
          works best for you.
        </p>
      </div>

      <section className="mb-20">
        <div className="mb-10">
          <h2 className="text-3xl font-bold">Get in Touch</h2>
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          {supportChannels.map((channel) => (
            <a
              key={channel.title}
              href={channel.href}
              rel={(channel.external ?? false) ? "noopener noreferrer" : undefined}
              target={(channel.external ?? false) ? "_blank" : undefined}
              className="group bg-landing-bg-light/50 hover:border-border-accent hover:bg-surface-panel/60 relative cursor-pointer overflow-hidden rounded-2xl border p-8 transition-all duration-300"
            >
              <div className="relative space-y-5">
                <div className="bg-surface-hover group-hover:border-border-accent flex size-14 items-center justify-center rounded-xl border transition-all">
                  <channel.icon className="text-foreground/60 size-7" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-foreground text-lg font-semibold">{channel.title}</h3>
                  <p className="text-text-secondary text-sm">{channel.description}</p>
                </div>
                <div className="text-foreground flex items-center gap-2 pt-2 text-sm font-medium transition-transform group-hover:translate-x-1">
                  {channel.action}
                  <MoveLeft className="size-4 rotate-180" />
                </div>
              </div>
            </a>
          ))}
        </div>
      </section>

      <section>
        <div className="mb-10">
          <h2 className="mb-3 text-3xl font-bold">Frequently Asked Questions</h2>
          <p className="text-text-secondary">Quick answers to common questions about Doxynix</p>
        </div>
        <Accordion type="single" collapsible className="w-full space-y-2">
          {faqItems.map((item) => (
            <AccordionListItem
              key={item.value}
              value={item.value}
              content={item.a}
              trigger={item.q}
              className="bg-landing-bg-light/50 hover:border-border-accent rounded-xl border px-4 transition-all duration-300"
            />
          ))}
        </Accordion>
      </section>
    </div>
  );
}
