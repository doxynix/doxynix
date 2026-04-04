"use client";

import { useParams } from "next/navigation";
import { Book, BookText, ChevronDown, CircleQuestionMark } from "lucide-react";
import { useTranslations } from "next-intl";

import { trpc } from "@/shared/api/trpc";
import { sidebarMenu } from "@/shared/constants/navigation";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/core/button";
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
  SidebarSeparator,
  useSidebar,
} from "@/shared/ui/core/sidebar";
import { Skeleton } from "@/shared/ui/core/skeleton";
import { Spinner } from "@/shared/ui/core/spinner";
import { AppTooltip } from "@/shared/ui/kit/app-tooltip";
import { LoadingButton } from "@/shared/ui/kit/loading-button";

import { SidebarLink } from "./sidebar-link";

export function AppSidebar() {
  const t = useTranslations("Dashboard");
  const { state } = useSidebar();
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } =
    trpc.repo.getAll.useInfiniteQuery(
      {
        limit: 10,
      },
      {
        getNextPageParam: (lastPage) => lastPage.meta.nextCursor,
        initialCursor: 1,
      }
    );

  const { data: stats } = trpc.notification.getStats.useQuery();

  const params = useParams();
  const owner = params.owner;
  const name = params.name;

  const isRepoOwnerPage = typeof owner === "string" && typeof name === "string";

  return (
    <Sidebar
      collapsible="offcanvas"
      variant="sidebar"
      className={cn(
        isRepoOwnerPage ? "top-29 h-[calc(100dvh-7rem)]" : "top-16 h-[calc(100dvh-4rem)]"
      )}
    >
      <SidebarHeader>
        <SidebarMenu>
          {sidebarMenu.map((item) => {
            const dynamicBadge = item.id === "notifications" ? stats?.unread : undefined;

            return <SidebarLink key={item.href} {...item} notificationsCount={dynamicBadge} />;
          })}
        </SidebarMenu>
      </SidebarHeader>
      <SidebarSeparator className="m-0" />

      <SidebarContent className="max-h-[calc(100dvh-HeaderHeight-FooterHeight)] overflow-hidden">
        <ScrollArea className="h-full">
          <Collapsible defaultOpen className="group/collapsible">
            <SidebarGroup>
              <SidebarGroupLabel asChild className="transition-standard truncate">
                <CollapsibleTrigger
                  className={cn(
                    "text-muted-foreground hover:bg-accent hover:text-foreground flex w-full cursor-pointer justify-between px-3",
                    state === "collapsed" && "pointer-events-none opacity-0"
                  )}
                >
                  <span>{t("recent_repositories")}</span>
                  <ChevronDown className="transition-standard ml-auto size-4 transition-transform group-data-[state=open]/collapsible:rotate-180" />
                </CollapsibleTrigger>
              </SidebarGroupLabel>
              <CollapsibleContent>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {isLoading && state === "expanded" && (
                      <div className="flex flex-col gap-2">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <div key={i} className="flex items-center justify-center gap-2 p-2">
                            <Skeleton className="size-4" />
                            <Skeleton className="h-4 w-full" />
                          </div>
                        ))}
                      </div>
                    )}
                    {isLoading && state === "collapsed" && (
                      <div className="flex flex-col gap-2">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <div key={i} className="flex items-center justify-center gap-2 p-2">
                            <Skeleton className="h-4 w-full" />
                          </div>
                        ))}
                      </div>
                    )}

                    {data?.pages.map((page) =>
                      page.items.map((repo) => (
                        <SidebarMenuItem key={repo.id} className="max-w-60">
                          <SidebarLink
                            href={`/dashboard/repo/${repo.owner}/${repo.name}`}
                            icon={Book}
                            label={`${repo.owner}/${repo.name}`}
                          />
                        </SidebarMenuItem>
                      ))
                    )}
                    {!isLoading && data?.pages[0]?.items.length === 0 && state === "expanded" && (
                      <div className="text-muted-foreground truncate px-4 py-2 text-xs">
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
                          {state === "expanded" ? (
                            <LoadingButton
                              disabled={isFetchingNextPage}
                              isLoading={isFetchingNextPage}
                              variant="ghost"
                              onClick={() => void fetchNextPage()}
                              className="text-muted-foreground flex h-8 w-full cursor-pointer items-center justify-start text-xs"
                            >
                              <ChevronDown /> {t("sidebar_show_more")}
                            </LoadingButton>
                          ) : (
                            <Button
                              variant="ghost"
                              onClick={() => void fetchNextPage()}
                              className="text-muted-foreground flex h-8 w-full cursor-pointer items-center justify-center p-1"
                            >
                              {isFetchingNextPage ? (
                                <Spinner className="text-muted-foreground" />
                              ) : (
                                <ChevronDown className="flex size-4 cursor-pointer items-center justify-center text-xs" />
                              )}
                            </Button>
                          )}
                        </SidebarMenuItem>
                      </AppTooltip>
                    )}
                  </SidebarMenu>
                </SidebarGroupContent>
              </CollapsibleContent>
            </SidebarGroup>
          </Collapsible>
        </ScrollArea>
      </SidebarContent>
      <SidebarSeparator className="m-0" />
      <SidebarFooter>
        <SidebarMenu>
          <SidebarLink href="/support" icon={CircleQuestionMark} label={t("sidebar_help")} />
          <SidebarLink
            href="https://docs.doxynix.space"
            isBlank
            icon={BookText}
            label={t("sidebar_documentation")}
          />
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
