import type { ComponentType } from "react";
import type { Route } from "next";
import { getTranslations } from "next-intl/server";

import { Link } from "@/shared/i18n/navigation";
import { CrunchbaseIcon } from "@/shared/ui/icons/crunchbase-icon";
import { GitHubIcon } from "@/shared/ui/icons/github-icon";
import { TelegramIcon } from "@/shared/ui/icons/telegram-icon";
import { DateComp } from "@/shared/ui/kit/date-comp";
import { ExternalLink } from "@/shared/ui/kit/external-link";

import { SystemStatus } from "./system-status";

type InternalLinkItem = {
  href: Route;
  label: string;
};

type SocialLinkItem = {
  href: string;
  icon: ComponentType<{ className: string }>;
  label: string;
};

const INTERNAL_LINKS_STYLE =
  "-my-2 px-1 py-2 text-center text-xs transition-colors hover:text-foreground";

const INTERNAL_LINKS = [
  {
    href: "/terms",
    label: "terms_of_service",
  },
  {
    href: "/privacy",
    label: "privacy_policy",
  },
  {
    href: "/high-five",
    label: "open_source_credits",
  },
] as const satisfies readonly InternalLinkItem[];

const SOCIAL_LINKS = [
  {
    href: "https://github.com/doxynix/doxynix",
    icon: GitHubIcon,
    label: "GitHub",
  },
  {
    href: "https://www.crunchbase.com/organization/doxynix",
    icon: CrunchbaseIcon,
    label: "Crunchbase",
  },
  {
    href: "https://t.me/doxynix",
    icon: TelegramIcon,
    label: "Telegram",
  },
] as const satisfies readonly SocialLinkItem[];

export async function AppFooter() {
  const tFooter = await getTranslations("Footer");
  const tCommon = await getTranslations("Common");

  return (
    <footer className="flex items-center justify-center bg-background p-2">
      <div className="container grid grid-cols-1 flex-col items-center justify-between justify-items-center gap-4 lg:flex lg:flex-row">
        <div className="order-1 flex flex-wrap items-center justify-center gap-4 lg:order-0">
          <p className="order-1 text-center text-muted-foreground text-xs lg:order-0">
            {`© `}
            <DateComp isYear /> {`Doxynix™. ${tFooter("all_rights_reserved")}`}
          </p>
          <SystemStatus />
        </div>
        <div className="flex xs:flex-row flex-col flex-wrap items-center justify-center not-md:justify-center gap-2 text-muted-foreground text-sm md:gap-6">
          {INTERNAL_LINKS.map((internal) => (
            <Link
              className={INTERNAL_LINKS_STYLE}
              href={internal.href}
              key={internal.href}
            >
              {tCommon(internal.label)}
            </Link>
          ))}

          <div className="flex items-center gap-4 border-border md:pl-6 xl:border-l">
            {SOCIAL_LINKS.map((social) => (
              <ExternalLink
                className="-m-2 p-2 hover:text-foreground"
                href={social.href}
                key={social.href}
              >
                <social.icon className="hidden size-4 md:block" />
                <span className="text-xs md:hidden">{social.label}</span>
                <span className="sr-only">{social.label}</span>
              </ExternalLink>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
