"use client";

import { usePathname } from "next/navigation";
import { Book, SlashIcon } from "lucide-react";

import { LOCALES, type Locale } from "@/shared/constants/locales";
import { cn } from "@/shared/lib/cn";
import { Button } from "@/shared/ui/core/button";
import { SidebarTrigger } from "@/shared/ui/core/sidebar";
import { Logo } from "@/shared/ui/icons/logo";
import { AppBreadcrumbs } from "@/shared/ui/kit/app-breadcrumbs";
import { AppTooltip } from "@/shared/ui/kit/app-tooltip";
import { ThemeToggle } from "@/shared/ui/kit/theme-toggle";
import { Link } from "@/i18n/routing";

import { RepoDetailsTabs } from "@/entities/repo-details/ui/repo-details-tabs";
import { useRepoParams } from "@/entities/repo/model/use-repo-params";

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
          : "max-w-[70px] xl:max-w-[120px]"
      ),
      href: `/${segments.slice(0, index + 1).join("/")}`,
      label,
    };
  });

  return (
    <header className="bg-background flex h-full flex-col justify-between px-4">
      <div className="flex w-full justify-between py-4">
        <div className="flex items-center gap-2.5">
          <AppTooltip content="Toggle Sidebar (ctrl+b)">
            <SidebarTrigger
              variant="ghost"
              className="text-muted-foreground hover:cursor-pointer"
            />
          </AppTooltip>

          <Logo className="mt-1 w-20" />

          <AppBreadcrumbs
            items={breadcrumbItems}
            separator={<SlashIcon className="size-3 rotate-340" />}
            showSeparatorAtStart={true}
            className="hidden md:block"
          />
        </div>

        <div className="flex items-center gap-2 md:gap-4">
          <AppTooltip content="Work in Progress">
            <span className="text-warning bg-warning/20 cursor-default rounded p-1 py-0.5 text-xs">
              BETA
            </span>
          </AppTooltip>
          <AppCommandMenu />
          <ThemeToggle />
          <AppTooltip content="Repositories">
            <Button asChild size="icon" variant="ghost">
              <Link href="/dashboard/repos" aria-label="Repositories">
                <Book />
              </Link>
            </Button>
          </AppTooltip>
          <NotificationsNav />
          <UserNav />
        </div>
      </div>
      {isRepoOwnerPage && <RepoDetailsTabs name={name} owner={owner} />}
    </header>
  );
}
