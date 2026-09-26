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

type FaqItem = { a: string; q: string; value: string };

export default async function SupportPage() {
  const tCommon = await getTranslations("Common");
  const t = await getTranslations("Support");

  const supportChannels = [
    {
      action: "support@doxynix.com",
      description: t("channel_email_desc"),
      href: "mailto:support@doxynix.com",
      icon: Mail,
      title: t("channel_email_title"),
    },
    {
      action: t("channel_github_action"),
      description: t("channel_github_desc"),
      external: true,
      href: "https://github.com/doxynix/doxynix/issues",
      icon: GitHubIcon,
      title: t("channel_github_title"),
    },
    {
      action: t("channel_discord_action"),
      description: t("channel_discord_desc"),
      external: true,
      href: "https://discord.gg/doxynix",
      icon: MessageSquare,
      title: t("channel_discord_title"),
    },
    {
      action: t("channel_docs_action"),
      description: t("channel_docs_desc"),
      external: true,
      href: "https://docs.doxynix.space",
      icon: BookOpen,
      title: t("channel_docs_title"),
    },
  ] satisfies SupportChannel[];

  const faqItems = [
    {
      a: t("faq_a1"),
      q: t("faq_q1"),
      value: "item-1",
    },
    {
      a: t("faq_a2"),
      q: t("faq_q2"),
      value: "item-2",
    },
    {
      a: t("faq_a3"),
      q: t("faq_q3"),
      value: "item-3",
    },
    {
      a: t("faq_a4"),
      q: t("faq_q4"),
      value: "item-4",
    },
    {
      a: t("faq_a5"),
      q: t("faq_q5"),
      value: "item-5",
    },
  ] as const satisfies readonly FaqItem[];

  return (
    <div className="container relative mx-auto min-h-dvh max-w-5xl animate-fade-in overflow-hidden px-4 py-12 pt-24">
      <BackOrLinkButton
        className="mb-8"
        label={tCommon("back")}
        showIcon
        variant="link"
      />

      <div className="mb-20">
        <h1 className="mb-6 font-bold text-5xl text-foreground md:text-6xl">{t("page_title")}</h1>
        <p className="max-w-2xl text-lg text-text-secondary">{t("page_desc")}</p>
      </div>

      <section className="mb-20">
        <div className="mb-10">
          <h2 className="font-bold text-3xl">{t("channels_title")}</h2>
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          {supportChannels.map((channel) => (
            <a
              className="group relative flex cursor-pointer flex-col gap-5 overflow-hidden rounded-2xl border bg-landing-bg-light/50 p-8 transition-standard hover:border-border-accent hover:bg-surface-panel"
              href={channel.href}
              key={channel.title}
              rel={(channel.external ?? false) ? "noopener noreferrer" : undefined}
              target={(channel.external ?? false) ? "_blank" : undefined}
            >
              <div className="flex size-14 items-center justify-center rounded-xl border bg-surface-hover transition-standard group-hover:border-border-accent">
                <channel.icon className="size-7 text-foreground" />
              </div>
              <h3 className="font-semibold text-foreground text-lg">{channel.title}</h3>
              <p className="-mt-3 text-sm text-text-secondary">{channel.description}</p>
              <div className="flex items-center gap-2 pt-2 font-medium text-foreground text-sm transition-transform group-hover:translate-x-1">
                {channel.action}
                <MoveLeft className="rotate-180" />
              </div>
            </a>
          ))}
        </div>
      </section>

      <section>
        <div className="mb-10">
          <h2 className="mb-3 font-bold text-3xl">{t("faq_title")}</h2>
          <p className="text-text-secondary">{t("faq_desc")}</p>
        </div>
        <Accordion
          className="flex w-full flex-col gap-2"
          collapsible
          type="single"
        >
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
