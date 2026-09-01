import type { ComponentType } from "react";
import { BookOpen, Mail, MessageSquare, MoveLeft } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { createMetadata } from "@/shared/lib/metadata";
import { Accordion } from "@/shared/ui/core/accordion";
import { GitHubIcon } from "@/shared/ui/icons/github-icon";
import { AccordionListItem } from "@/shared/ui/kit/accordion-list-item";
import { BackOrLinkButton } from "@/shared/ui/kit/back-or-link-button";

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
    <div className="container relative mx-auto min-h-dvh max-w-5xl animate-fade-in overflow-hidden px-4 py-12 pt-24">
      <BackOrLinkButton
        className="mb-8 cursor-pointer"
        label={tCommon("back")}
        showIcon
        variant="link"
      />

      <div className="mb-20">
        <h1 className="mb-6 font-bold text-5xl text-foreground md:text-6xl">
          We&apos;re here to help
        </h1>
        <p className="max-w-2xl text-lg text-text-secondary">
          Multiple ways to get support, advice, and connect with our team. Choose the channel that
          works best for you.
        </p>
      </div>

      <section className="mb-20">
        <div className="mb-10">
          <h2 className="font-bold text-3xl">Get in Touch</h2>
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          {supportChannels.map((channel) => (
            <a
              className="group relative cursor-pointer overflow-hidden rounded-2xl border bg-landing-bg-light/50 p-8 transition-standard hover:border-border-accent hover:bg-surface-panel"
              href={channel.href}
              key={channel.title}
              rel={(channel.external ?? false) ? "noopener noreferrer" : undefined}
              target={(channel.external ?? false) ? "_blank" : undefined}
            >
              <div className="relative flex flex-col gap-5">
                <div className="flex size-14 items-center justify-center rounded-xl border bg-surface-hover transition-standard group-hover:border-border-accent">
                  <channel.icon className="size-7 text-foreground" />
                </div>
                <div className="flex flex-col gap-2">
                  <h3 className="font-semibold text-foreground text-lg">{channel.title}</h3>
                  <p className="text-sm text-text-secondary">{channel.description}</p>
                </div>
                <div className="flex items-center gap-2 pt-2 font-medium text-foreground text-sm transition-transform group-hover:translate-x-1">
                  {channel.action}
                  <MoveLeft className="rotate-180" />
                </div>
              </div>
            </a>
          ))}
        </div>
      </section>

      <section>
        <div className="mb-10">
          <h2 className="mb-3 font-bold text-3xl">Frequently Asked Questions</h2>
          <p className="text-text-secondary">Quick answers to common questions about Doxynix</p>
        </div>
        <Accordion className="flex w-full flex-col gap-2" collapsible type="single">
          {faqItems.map((item) => (
            <AccordionListItem
              className="rounded-xl border bg-landing-bg-light/50 px-4 transition-standard hover:border-border-accent"
              content={item.a}
              key={item.value}
              trigger={item.q}
              value={item.value}
            />
          ))}
        </Accordion>
      </section>
    </div>
  );
}
