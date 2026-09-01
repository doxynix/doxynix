"use client";

import { Book, SlashIcon } from "lucide-react";

import { LOCALES, type Locale } from "@/shared/constants/locales";
import { Link, usePathname } from "@/shared/i18n/navigation";
import { cn } from "@/shared/lib/cn";
import { Logo } from "@/shared/ui/branding/doxynix-logo";
import { AppButton } from "@/shared/ui/core/button";
import { SidebarTrigger } from "@/shared/ui/core/sidebar";
import { AppBreadcrumbs } from "@/shared/ui/kit/app-breadcrumbs";
import { AppTooltip } from "@/shared/ui/kit/app-tooltip";
import { ThemeToggle } from "@/shared/ui/kit/theme-toggle";

import { useRepoParams } from "@/entities/repo/model/use-repo-params";
import { RepoDetailsTabs } from "@/entities/repo/ui/repo-details-tabs";

import { AgentButton } from "./agent-button";
import { AppCommandMenu } from "./app-command-menu";
import { NotificationsNav } from "./notifications-nav";
import { UserNav } from "./user-nav";

function stripLocalePrefix(pathname: string) {
  const segments = pathname.split("/").filter(Boolean);
  const first = segments[0];
  if (first != null && LOCALES.includes(first as Locale)) {
    segments.shift();
  }
  return `/${segments.join("/")}`;
}

export function AppHeader() {
  const { name, owner } = useRepoParams();
  const rawPathname = usePathname();
  const pathname = stripLocalePrefix(rawPathname);
  const segments = pathname.split("/").filter(Boolean);
  const isRepoOwnerPage = owner !== "" && name !== "";

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
          <AppTooltip content="Toggle Sidebar (ctrl+b)">
            <SidebarTrigger
              className="text-muted-foreground hover:cursor-pointer"
              variant="ghost"
            />
          </AppTooltip>

          <Logo className="mt-1 w-20" />

          <AppBreadcrumbs
            className="hidden md:block"
            items={breadcrumbItems}
            separator={<SlashIcon className="size-3 rotate-340" />}
            showSeparatorAtStart={true}
          />
        </div>

        <div className="flex items-center gap-2 md:gap-4">
          <AgentButton />
          <AppTooltip content="Work in Progress">
            <span className="cursor-default rounded bg-warning/20 p-1 py-0.5 text-warning text-xs">
              BETA
            </span>
          </AppTooltip>
          <AppCommandMenu />
          <ThemeToggle />
          <AppTooltip content="Repositories">
            <AppButton asChild size="icon" variant="ghost">
              <Link aria-label="Repositories" href="/dashboard/repos">
                <Book />
              </Link>
            </AppButton>
          </AppTooltip>
          <NotificationsNav />
          <UserNav />
        </div>
      </div>
      {isRepoOwnerPage && <RepoDetailsTabs name={name} owner={owner} />}
    </header>
  );
}
