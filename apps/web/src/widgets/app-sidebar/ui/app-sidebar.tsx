"use client";
import { useInfiniteQuery } from "@tanstack/react-query";
import { BookText, ChevronDown, CircleQuestionMark } from "lucide-react";
import { useTranslations } from "next-intl";

import { useTRPC } from "@/shared/api/trpc";
import { sidebarMenu } from "@/shared/config/navigation";
import { useNavLabels } from "@/shared/config/navigation-labels";
import { REPO_LIST_PAGE_SIZE } from "@/shared/config/repos";
import { cn } from "@/shared/lib/cn";
import { useAppearancePreferences } from "@/shared/lib/hooks/use-appearance-preferences";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/shared/ui/core/collapsible";
import { ScrollArea } from "@/shared/ui/core/scroll-area";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuSkeleton,
  SidebarRail,
  SidebarSeparator,
  useSidebar,
} from "@/shared/ui/core/sidebar";
import { AppTooltip } from "@/shared/ui/kit/app-tooltip";
import { LoadingButton } from "@/shared/ui/kit/loading-button";

import { useRepoParams } from "@/entities/repo/model/use-repo-params";

import { useNotificationStats } from "@/features/notifications/model/use-notification-stats";

import { SidebarLink } from "./sidebar-link";

export function AppSidebar() {
  const trpc = useTRPC();
  const t = useTranslations("Dashboard");
  const tCommon = useTranslations("Common");
  const navLabels = useNavLabels();
  const { preferences } = useAppearancePreferences();
  const { state } = useSidebar();
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useInfiniteQuery(
    trpc.repo.getSlim.infiniteQueryOptions(
      {
        limit: REPO_LIST_PAGE_SIZE,
      },
      {
        getNextPageParam: (lastPage) => lastPage.meta.nextCursor,
        initialCursor: undefined,
      },
    ),
  );

  const { data: stats } = useNotificationStats();

  const { name, owner } = useRepoParams();

  const isRepoOwnerPage = owner !== "" && name !== "";

  return (
    <Sidebar
      className={cn(
        isRepoOwnerPage ? "top-29 h-[calc(100dvh-7rem)]" : "top-16 h-[calc(100dvh-4rem)]",
      )}
      collapsible={preferences.collapsible}
      variant={preferences.sidebarVariant}
    >
      <nav aria-label={tCommon("main_navigation")}>
        <SidebarHeader>
          <SidebarMenu>
            {sidebarMenu.map((item) => {
              const dynamicBadge = item.id === "notifications" ? stats?.unread : undefined;
              return (
                <SidebarMenuItem key={item.href}>
                  <SidebarLink
                    {...item}
                    label={navLabels[item.labelKey]}
                    notificationsCount={dynamicBadge}
                  />
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </SidebarHeader>
      </nav>
      <SidebarSeparator className="m-0" />

      <SidebarContent className="max-h-[calc(100dvh-HeaderHeight-FooterHeight)] overflow-hidden">
        <ScrollArea className="h-full">
          <nav
            aria-label={tCommon("nav_repositories")}
            className="min-w-0"
          >
            <Collapsible
              className="group/collapsible"
              defaultOpen
            >
              <SidebarGroup>
                <SidebarGroupLabel
                  asChild
                  className="truncate transition-standard"
                >
                  <CollapsibleTrigger
                    className={cn(
                      "mb-1 flex w-full justify-between px-3 text-muted-foreground hover:bg-accent hover:text-foreground",
                    )}
                    disabled={state === "collapsed"}
                  >
                    <span>{t("recent_repositories")}</span>
                    <ChevronDown className="ml-auto transition-transform group-data-[state=open]/collapsible:rotate-180" />
                  </CollapsibleTrigger>
                </SidebarGroupLabel>
                <CollapsibleContent>
                  <SidebarGroupContent>
                    <SidebarMenu>
                      {isLoading &&
                        Array.from({ length: REPO_LIST_PAGE_SIZE }).map((_, i) => (
                          <SidebarMenuItem key={i}>
                            <SidebarMenuSkeleton showIcon />
                          </SidebarMenuItem>
                        ))}

                      {data?.pages.map((page) =>
                        page.items.map((repo) => (
                          <SidebarMenuItem
                            className="min-w-0 max-w-[calc(var(--sidebar-width)-1.0625rem)]"
                            key={repo.id}
                          >
                            <SidebarLink
                              avatar={repo.avatar ?? ""}
                              href={`/dashboard/repo/${repo.owner}/${repo.name}`}
                              label={`${repo.owner}/${repo.name}`}
                            />
                          </SidebarMenuItem>
                        )),
                      )}
                      {!isLoading && data?.pages[0]?.items.length === 0 && state === "expanded" && (
                        <SidebarMenuItem>
                          <div className="truncate px-4 py-2 text-muted-foreground text-xs">
                            {t("repo_empty_title")}
                          </div>
                        </SidebarMenuItem>
                      )}
                      {hasNextPage && (
                        <AppTooltip
                          content={t("sidebar_show_more")}
                          hidden={state !== "collapsed"}
                          side="right"
                        >
                          <SidebarMenuItem className="truncate">
                            <LoadingButton
                              className="flex h-8 w-full items-center justify-start text-muted-foreground text-xs group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0"
                              disabled={isFetchingNextPage}
                              isLoading={isFetchingNextPage}
                              onClick={() => void fetchNextPage()}
                              variant="ghost"
                            >
                              <ChevronDown />
                              <span className="truncate group-data-[collapsible=icon]:hidden">
                                {t("sidebar_show_more")}
                              </span>
                            </LoadingButton>
                          </SidebarMenuItem>
                        </AppTooltip>
                      )}
                    </SidebarMenu>
                  </SidebarGroupContent>
                </CollapsibleContent>
              </SidebarGroup>
            </Collapsible>
          </nav>
        </ScrollArea>
      </SidebarContent>
      <SidebarSeparator className="m-0" />
      <SidebarFooter>
        <nav aria-label={tCommon("support_and_documentation")}>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarLink
                href="/support"
                icon={CircleQuestionMark}
                label={t("sidebar_help")}
              />
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarLink
                href="https://docs.doxynix.space"
                icon={BookText}
                isBlank
                label={t("sidebar_documentation")}
              />
            </SidebarMenuItem>
          </SidebarMenu>
        </nav>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
