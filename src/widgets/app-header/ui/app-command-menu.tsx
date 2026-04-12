"use client";

import React, { useEffect, useRef, useState } from "react";
import type { Route } from "next";
import { Book, ChevronDown, Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { useDebounce } from "use-debounce";

import { trpc } from "@/shared/api/trpc";
import { commandMenuItems } from "@/shared/constants/navigation";
import { cn } from "@/shared/lib/utils";
import type { MenuItem } from "@/shared/types/navigation.types";
import { Button } from "@/shared/ui/core/button";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/shared/ui/core/command";
import { Spinner } from "@/shared/ui/core/spinner";
import { AppTooltip } from "@/shared/ui/kit/app-tooltip";
import { useRouter } from "@/i18n/routing";

import { useCommandMenuActions, useCommandMenuIsOpen } from "@/entities/command-menu";
import { useCreateRepoActions } from "@/entities/repo";

export function AppCommandMenu() {
  const t = useTranslations("Dashboard");
  const open = useCommandMenuIsOpen();
  const { setOpen } = useCommandMenuActions();
  const [search, setSearch] = useState("");
  const [debouncedSearch] = useDebounce(search, 300);
  const [isReposExpanded, setIsReposExpanded] = useState(true);
  const { setOpen: setOpenCreateDialog } = useCreateRepoActions();

  const router = useRouter();
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } =
    trpc.repo.getAll.useInfiniteQuery(
      {
        limit: 10,
        search: debouncedSearch || undefined,
      },
      {
        enabled: open,
        getNextPageParam: (lastPage) => lastPage.meta.nextCursor,
        initialCursor: 1,
      }
    );

  const observerTarget = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!hasNextPage || isFetchingNextPage || !isReposExpanded) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry != null && entry.isIntersecting) {
          void fetchNextPage();
        }
      },
      { threshold: 0.1 }
    );

    const currentTarget = observerTarget.current;
    if (currentTarget) {
      observer.observe(currentTarget);
    }

    return () => {
      if (currentTarget) observer.unobserve(currentTarget);
    };
  }, [hasNextPage, isFetchingNextPage, fetchNextPage, isReposExpanded]);

  React.useEffect(() => {
    if (debouncedSearch.length > 0) {
      setIsReposExpanded(true);
    }
  }, [debouncedSearch]);

  React.useEffect(() => {
    if (open) {
      setSearch("");
    }
  }, [open]);

  const navigate = (path: string) => {
    setOpen(false);
    router.push(path as Route);
  };

  const runCommand = (item: MenuItem) => {
    setOpen(false);

    switch (item.commandType) {
      case "dialog": {
        if (item.actionId === "createRepo") {
          setOpenCreateDialog(true);
        }
        break;
      }

      case "action": {
        break;
      }

      case "navigation":
      case undefined: {
        if (item.href != null) {
          navigate(item.href);
        }
        break;
      }
      default: {
        break;
      }
    }
  };

  const s = search.trim().toLowerCase();

  const filteredCommands = !s
    ? commandMenuItems
    : commandMenuItems.filter(
        (item) =>
          (item.label.toLowerCase().includes(s) || item.url?.toLowerCase().includes(s)) ?? false
      );

  return (
    <>
      <AppTooltip content="Search site" className="lg:hidden">
        <Button
          variant="outline"
          aria-label="Search site"
          onClick={() => setOpen(true)}
          className={cn(
            "text-muted-foreground lg:border-border/70 lg:bg-surface-hover/70 relative size-9 justify-start rounded-xl text-sm font-normal not-lg:border-0 not-lg:p-0 lg:w-64 lg:pr-12"
          )}
        >
          <Search className="absolute top-2.25 left-2.25" />

          <span className="hidden lg:inline-flex lg:pl-4">{t("command_search")}</span>
          <CommandShortcut className="absolute top-1.5 right-3 hidden text-xs lg:flex">
            Ctrl+K
          </CommandShortcut>
        </Button>
      </AppTooltip>

      <CommandDialog open={open} shouldFilter={false} onOpenChange={setOpen}>
        <CommandInput
          value={search}
          isLoading={isLoading}
          placeholder={t("command_placeholder")}
          onValueChange={setSearch}
        />
        <CommandList>
          {filteredCommands.length === 0 && (
            <CommandEmpty>{t("command_empty_results")}</CommandEmpty>
          )}

          {filteredCommands.length > 0 && (
            <CommandGroup heading={t("command_menu_label_1")}>
              {filteredCommands.map((item) => {
                const isDestructive = item.variant === "destructive";
                return (
                  <CommandItem
                    key={item.label}
                    value={item.label}
                    onSelect={() => runCommand(item)}
                    className={cn(
                      isDestructive &&
                        "text-destructive data-[selected=true]:bg-destructive/10 data-[selected=true]:text-destructive",
                      "flex items-center justify-between"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <item.icon />
                      <span>{item.label}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      {item.url != null && (
                        <kbd className="text-muted-foreground px-1.5 py-0.5 text-xs">
                          {item.url}
                        </kbd>
                      )}
                      {item.shortcut != null && (
                        <CommandShortcut className="hidden text-xs md:flex">
                          {item.shortcut}
                        </CommandShortcut>
                      )}
                    </div>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          )}

          <CommandSeparator />

          <CommandGroup
            heading={
              <div className="flex w-full items-center justify-between">
                <span>{t("command_menu_label_2")}</span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setIsReposExpanded(!isReposExpanded);
                  }}
                  className="text-muted-foreground cursor-pointer bg-transparent"
                >
                  {isReposExpanded ? t("command_collapse") : t("command_expand")}
                  <ChevronDown
                    className={cn(
                      "transition-standard transition-transform",
                      isReposExpanded && "rotate-180"
                    )}
                  />
                </Button>
              </div>
            }
          >
            {isReposExpanded && (
              <>
                {data?.pages
                  .flatMap((p) => p.items)
                  .map((repo) => (
                    <CommandItem
                      key={repo.id}
                      value={`${repo.owner}/${repo.name}`}
                      onSelect={() => navigate(`/dashboard/repo/${repo.owner}/${repo.name}`)}
                    >
                      <Book />
                      <div className="line-clamp-1 flex">
                        <span className="text-muted-foreground truncate font-bold">
                          {repo.owner}
                        </span>
                        <span className="text-muted-foreground">/</span>
                        <span className="truncate font-bold">{repo.name}</span>
                      </div>
                    </CommandItem>
                  ))}
                {hasNextPage && (
                  <div ref={observerTarget} className="my-2 flex items-center justify-center">
                    {isFetchingNextPage && <Spinner />}
                  </div>
                )}
              </>
            )}
          </CommandGroup>

          {!isLoading && data?.pages[0]?.meta.totalCount === 0 && (
            <div className="text-muted-foreground p-4 text-center text-xs">
              {t("repo_empty_title")}
            </div>
          )}
        </CommandList>
      </CommandDialog>
    </>
  );
}
