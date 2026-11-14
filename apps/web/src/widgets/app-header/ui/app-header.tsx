"use client";

import type { Route } from "next";
import { Book, SlashIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { LOCALES, type Locale } from "@/shared/config/locales";
import { userNavMenu } from "@/shared/config/navigation";
import { useNavLabels } from "@/shared/config/navigation-labels";
import { Link, usePathname } from "@/shared/i18n/navigation";
import { cn } from "@/shared/lib/cn";
import { useModifierKey } from "@/shared/lib/hooks/use-modifier-key";
import { Logo } from "@/shared/ui/branding/doxynix-logo";
import { AppButton } from "@/shared/ui/core/button";
import { Kbd, KbdGroup } from "@/shared/ui/core/kbd";
import { SidebarTrigger } from "@/shared/ui/core/sidebar";
import { AppBreadcrumbs } from "@/shared/ui/kit/app-breadcrumbs";
import { AppTooltip } from "@/shared/ui/kit/app-tooltip";

import { useRepoParams } from "@/entities/repo/model/use-repo-params";
import { RepoDetailsTabs } from "@/entities/repo/ui/repo-details-tabs";
import { UserMenu, type UserMenuItem } from "@/entities/user/ui/user-menu";

import { WorkspaceSwitcher } from "@/features/workspace/ui/workspace-switcher";

import { AgentButton } from "./agent-button";
import { AppCommandMenu } from "./app-command-menu";
import { NotificationsNav } from "./notifications-nav";

function stripLocalePrefix(pathname: string) {
  const segments = pathname.split("/").filter(Boolean);
  const first = segments[0];
  if (first != null && LOCALES.includes(first as Locale)) {
    segments.shift();
  }
  return `/${segments.join("/")}`;
}

export function AppHeader() {
  const tCommon = useTranslations("Common");
  const navLabels = useNavLabels();
  const modifierKey = useModifierKey();
  const { name, owner } = useRepoParams();
  const rawPathname = usePathname();
  const pathname = stripLocalePrefix(rawPathname);
  const segments = pathname.split("/").filter(Boolean);
  const isRepoOwnerPage = owner !== "" && name !== "";

  const userMenuItems: UserMenuItem[] = userNavMenu
    .filter((item): item is typeof item & { href: string } => item.href != null)
    .map((item) => ({
      href: item.href as Route,
      icon: item.icon,
      label: navLabels[item.labelKey],
      shortcut: item.shortcut,
    }));

  const breadcrumbItems = segments.map((segment, index) => {
    const label = /^\d+$/.test(segment) ? `#${segment}` : segment;

    return {
      className: cn(
        "lowercase",
        index === segments.length - 1
          ? "max-w-[140px] xl:max-w-[300px]"
          : "max-w-[70px] xl:max-w-[120px]",
      ),
      href: `/${segments.slice(0, index + 1).join("/")}`,
      label,
    };
  });

  return (
    <header className="flex h-full flex-col justify-between bg-background px-4">
      <div className="flex w-full justify-between py-4">
        <div className="flex items-center gap-2.5">
          <AppTooltip
            content={
              <span className="flex items-center gap-1.5">
                {tCommon("toggle_sidebar_shortcut")}
                <KbdGroup>
                  <Kbd>{modifierKey}</Kbd>
                  <Kbd>B</Kbd>
                </KbdGroup>
              </span>
            }
          >
            <SidebarTrigger
              className="text-muted-foreground"
              variant="ghost"
            />
          </AppTooltip>

          <Logo className="mt-1 w-20" />

          <WorkspaceSwitcher />

          <AppBreadcrumbs
            className="hidden md:block"
            items={breadcrumbItems}
            separator={<SlashIcon className="size-3 rotate-340" />}
            showSeparatorAtStart={true}
          />
        </div>

        <div className="flex items-center gap-2 md:gap-4">
          <AgentButton />
          <AppTooltip content={tCommon("work_in_progress")}>
            <span className="cursor-default rounded bg-warning/20 p-1 py-0.5 text-warning text-xs">
              {tCommon("beta")}
            </span>
          </AppTooltip>
          <AppCommandMenu />
          <AppTooltip content={tCommon("nav_repositories")}>
            <AppButton
              asChild
              size="icon"
              variant="ghost"
            >
              <Link
                aria-label={tCommon("nav_repositories")}
                href="/dashboard/repos"
              >
                <Book />
              </Link>
            </AppButton>
          </AppTooltip>
          <NotificationsNav />
          <UserMenu items={userMenuItems} />
        </div>
      </div>
      {isRepoOwnerPage && (
        <RepoDetailsTabs
          name={name}
          owner={owner}
        />
      )}
    </header>
  );
}
