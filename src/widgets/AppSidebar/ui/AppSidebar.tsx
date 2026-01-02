"use client";

import { useEffect } from "react";
import { BookText, ChevronDown, CircleQuestionMark } from "lucide-react";

import { trpc } from "@/shared/api/trpc";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/shared/ui/collapsible";
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
} from "@/shared/ui/sidebar";
import { Skeleton } from "@/shared/ui/skeleton";
import { Spinner } from "@/shared/ui/spinner";
import { SidebarLink } from "@/widgets/AppSidebar";
import { menu } from "@/widgets/AppSidebar/menu";

export function AppSidebar() {
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

  useEffect(() => {
    if (state === "collapsed") {
      document.querySelector("#sidebar-root")?.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [state]);

  return (
    <Sidebar className="top-16 h-[calc(100vh-4rem)]" collapsible="icon" variant="sidebar">
      <SidebarHeader>
        <SidebarMenu>
          {menu.map((item) => (
            <SidebarLink key={item.href} href={item.href} icon={item.icon} title={item.title} />
          ))}
        </SidebarMenu>
      </SidebarHeader>
      <SidebarSeparator className="m-0" />
      <SidebarContent className="max-h-[calc(100vh-HeaderHeight-FooterHeight)] overflow-y-auto">
        <Collapsible defaultOpen className="group/collapsible">
          <SidebarGroup>
            <SidebarGroupLabel className="truncate" asChild>
              <CollapsibleTrigger className="flex cursor-pointer justify-between hover:underline">
                <span>Недавние репозитории</span>
                <ChevronDown className="ml-auto h-4 w-4 transition-transform duration-300 group-data-[state=open]/collapsible:rotate-180" />{" "}
              </CollapsibleTrigger>
            </SidebarGroupLabel>
            <CollapsibleContent>
              <SidebarGroupContent
                className={cn(
                  "transition-opacity",
                  state === "expanded" ? "opacity-100" : "opacity-0"
                )}
              >
                <SidebarMenu>
                  {isLoading && (
                    <div className="flex flex-col gap-2">
                      <Skeleton className="h-8 w-full" />
                      <Skeleton className="h-8 w-full" />
                      <Skeleton className="h-8 w-full" />
                      <Skeleton className="h-8 w-full" />
                      <Skeleton className="h-8 w-full" />
                    </div>
                  )}

                  {data?.pages.map((page) =>
                    page.items.map((repo) => (
                      <SidebarMenuItem key={repo.id}>
                        <SidebarLink
                          title={`${repo.owner}/${repo.name}`}
                          href={`/repo/${repo.owner}/${repo.name}`}
                        />
                      </SidebarMenuItem>
                    ))
                  )}
                  {!isLoading && data?.pages[0]?.items.length === 0 && (
                    <div className="text-muted-foreground px-4 py-2 text-xs">Нет репозиториев</div>
                  )}
                  {hasNextPage && state !== "collapsed" && (
                    <SidebarMenuItem>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-muted-foreground h-8 w-full justify-start pl-2 text-xs"
                        onClick={() => fetchNextPage()}
                        disabled={isFetchingNextPage}
                      >
                        {isFetchingNextPage ? (
                          <Spinner className="mr-2 h-3 w-3" />
                        ) : (
                          <ChevronDown className="mr-2 h-3 w-3" />
                        )}
                        {isFetchingNextPage ? "Загрузка..." : "Показать еще"}
                      </Button>
                    </SidebarMenuItem>
                  )}
                </SidebarMenu>
              </SidebarGroupContent>
            </CollapsibleContent>
          </SidebarGroup>
        </Collapsible>
      </SidebarContent>
      <SidebarSeparator className="m-0" />
      <SidebarFooter>
        <SidebarMenu>
          <SidebarLink title="Помощь" href="/help" icon={CircleQuestionMark} />
          <SidebarLink
            title="Документация"
            href="https://docs.doxynix.space"
            icon={BookText}
            isBlank
          />
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
