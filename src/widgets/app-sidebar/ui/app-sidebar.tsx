"use client";

import { Book, BookText, ChevronDown, CircleQuestionMark } from "lucide-react";
import { useTranslations } from "next-intl";

import { trpc } from "@/shared/api/trpc";
import { sidebarMenu } from "@/shared/constants/navigation";
import { useIsMobile } from "@/shared/hooks/use-mobile";
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
  const isMobile = useIsMobile();
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

  return (
    <Sidebar className="top-16 h-[calc(100vh-4rem)]" collapsible="icon" variant="sidebar">
      <SidebarHeader>
        <SidebarMenu>
          {sidebarMenu.map((item) => (
            <SidebarLink key={item.href} {...item} />
          ))}
        </SidebarMenu>
      </SidebarHeader>
      <SidebarSeparator className="m-0" />

      <SidebarContent className="max-h-[calc(100vh-HeaderHeight-FooterHeight)] overflow-hidden">
        <ScrollArea className="h-full">
          <Collapsible defaultOpen className="group/collapsible">
            <SidebarGroup>
              <SidebarGroupLabel className="truncate" asChild>
                <CollapsibleTrigger
                  className={cn(
                    "flex cursor-pointer justify-between hover:underline",
                    state === "collapsed" && "pointer-events-none"
                  )}
                >
                  {(state === "expanded" || isMobile === true) && (
                    <span>{t("recent_repositories")}</span>
                  )}
                  <ChevronDown className="ml-auto h-4 w-4 transition-transform duration-300 group-data-[state=open]/collapsible:rotate-180" />
                </CollapsibleTrigger>
              </SidebarGroupLabel>
              <CollapsibleContent>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {isLoading && state === "expanded" && (
                      <div className="flex flex-col gap-2">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <div key={i} className="flex items-center justify-center gap-2 p-2">
                            <Skeleton className="h-4 w-4" />
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
                        <SidebarMenuItem className="max-w-60" key={repo.id}>
                          <SidebarLink
                            icon={Book}
                            label={`${repo.owner}/${repo.name}`}
                            href={`/dashboard/repo/${repo.owner}/${repo.name}`}
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
                        side="right"
                        content={t("sidebar_show_more")}
                        hidden={state !== "collapsed"}
                      >
                        <SidebarMenuItem className="truncate">
                          {state === "expanded" ? (
                            <LoadingButton
                              variant="ghost"
                              className="text-muted-foreground hover:text-foreground hover:bg-primary/90 flex h-8 w-full cursor-pointer items-center justify-start text-xs"
                              disabled={isFetchingNextPage}
                              onClick={() => fetchNextPage()}
                              isLoading={isFetchingNextPage}
                              loadingText=""
                            >
                              <ChevronDown /> <>{t("sidebar_show_more")}</>
                            </LoadingButton>
                          ) : (
                            <Button
                              onClick={() => fetchNextPage()}
                              variant="ghost"
                              className="text-muted-foreground hover:text-foreground hover:bg-primary/90 flex h-8 w-full cursor-pointer items-center justify-center p-1"
                            >
                              {isFetchingNextPage ? (
                                <Spinner className="text-muted-foreground h-4 w-4" />
                              ) : (
                                <ChevronDown className="flex h-4 w-4 cursor-pointer items-center justify-center text-xs" />
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
          <SidebarLink label={t("sidebar_help")} href="/support" icon={CircleQuestionMark} />
          <SidebarLink
            label={t("sidebar_documentation")}
            href="https://docs.doxynix.space"
            icon={BookText}
            isBlank
          />
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
