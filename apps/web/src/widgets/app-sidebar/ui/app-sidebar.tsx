"use client";

import { BookText, ChevronDown, CircleQuestionMark } from "lucide-react";
import { useTranslations } from "next-intl";

import { trpc } from "@/shared/api/trpc";
import { sidebarMenu } from "@/shared/constants/navigation";
import { cn } from "@/shared/lib/cn";
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

import { SidebarLink } from "./sidebar-link";

export function AppSidebar() {
  const t = useTranslations("Dashboard");
  const { state } = useSidebar();
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } =
    trpc.repo.getSlim.useInfiniteQuery(
      {
        limit: 5,
      },
      {
        getNextPageParam: (lastPage) => lastPage.meta.nextCursor,
        initialCursor: 1,
      },
    );

  const { data: stats } = trpc.notification.getStats.useQuery();

  const { name, owner } = useRepoParams();

  const isRepoOwnerPage = owner !== "" && name !== "";

  return (
    <Sidebar
      className={cn(
        isRepoOwnerPage ? "top-29 h-[calc(100dvh-7rem)]" : "top-16 h-[calc(100dvh-4rem)]",
      )}
      collapsible="offcanvas"
      variant="sidebar"
    >
      <nav aria-label="Main navigation">
        <SidebarHeader>
          <SidebarMenu>
            {sidebarMenu.map((item) => {
              const dynamicBadge = item.id === "notifications" ? stats?.unread : undefined;
              return (
                <SidebarMenuItem key={item.href}>
                  <SidebarLink {...item} notificationsCount={dynamicBadge} />
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </SidebarHeader>
      </nav>
      <SidebarSeparator className="m-0" />

      <SidebarContent className="max-h-[calc(100dvh-HeaderHeight-FooterHeight)] overflow-hidden">
        <ScrollArea className="h-full">
          <nav aria-label="Repositories">
            <Collapsible className="group/collapsible" defaultOpen>
              <SidebarGroup>
                <SidebarGroupLabel asChild className="truncate transition-standard">
                  <CollapsibleTrigger
                    className={cn(
                      "mb-1 flex w-full cursor-pointer justify-between px-3 text-muted-foreground hover:bg-accent hover:text-foreground",
                    )}
                    disabled={state === "collapsed"}
                  >
                    <span>{t("recent_repositories")}</span>
                    <ChevronDown className="ml-auto transition-standard transition-transform group-data-[state=open]/collapsible:rotate-180" />
                  </CollapsibleTrigger>
                </SidebarGroupLabel>
                <CollapsibleContent>
                  <SidebarGroupContent>
                    <SidebarMenu>
                      {isLoading &&
                        Array.from({ length: 5 }).map((_, i) => (
                          <SidebarMenuItem key={i}>
                            <SidebarMenuSkeleton showIcon />
                          </SidebarMenuItem>
                        ))}

                      {data?.pages.map((page) =>
                        page.items.map((repo) => (
                          <SidebarMenuItem className="max-w-60" key={repo.id}>
                            <SidebarLink
                              avatar={repo.avatar ?? ""}
                              href={`/dashboard/repo/${repo.owner}/${repo.name}`}
                              label={`${repo.owner}/${repo.name}`}
                            />
                          </SidebarMenuItem>
                        )),
                      )}
                      {!isLoading && data?.pages[0]?.items.length === 0 && state === "expanded" && (
                        <div className="truncate px-4 py-2 text-muted-foreground text-xs">
                          {t("repo_empty_title")}
                        </div>
                      )}
                      {hasNextPage && (
                        <AppTooltip
                          content={t("sidebar_show_more")}
                          hidden={state !== "collapsed"}
                          side="right"
                        >
                          <SidebarMenuItem className="truncate">
                            <LoadingButton
                              className="flex h-8 w-full cursor-pointer items-center justify-start text-muted-foreground text-xs"
                              disabled={isFetchingNextPage}
                              isLoading={isFetchingNextPage}
                              onClick={() => void fetchNextPage()}
                              variant="ghost"
                            >
                              <ChevronDown /> {t("sidebar_show_more")}
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
        <nav aria-label="Support and Documentation">
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarLink href="/support" icon={CircleQuestionMark} label={t("sidebar_help")} />
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
