"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Search } from "lucide-react";
import { useTranslations } from "next-intl";

import { trpc } from "@/shared/api/trpc";
import { commandMenuItems } from "@/shared/constants/navigation";
import { useDebounce } from "@/shared/hooks/use-debounce";
import { useRouter } from "@/shared/i18n/navigation";
import { cn } from "@/shared/lib/cn";
import type { MenuItem } from "@/shared/types/navigation.types";
import { AppButton } from "@/shared/ui/core/button";
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
import { AppAvatar } from "@/shared/ui/kit/app-avatar";
import { AppTooltip } from "@/shared/ui/kit/app-tooltip";

import { useCreateRepoActions } from "@/entities/repo/model/use-create-repo-dialog.store";

import {
  useCommandMenuActions,
  useCommandMenuIsOpen,
} from "@/features/command-menu/model/use-command-menu.store";

export function AppCommandMenu() {
  const t = useTranslations("Dashboard");
  const open = useCommandMenuIsOpen();
  const { setOpen } = useCommandMenuActions();
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [isReposExpanded, setIsReposExpanded] = useState(true);
  const { setOpen: setOpenCreateDialog } = useCreateRepoActions();

  const router = useRouter();
  const [prevOpen, setPrevOpen] = useState(open);
  const isOpening = open && open !== prevOpen;

  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setSearch("");
    }
  }

  const [prevDebouncedSearch, setPrevDebouncedSearch] = useState(debouncedSearch);

  if (debouncedSearch !== prevDebouncedSearch) {
    setPrevDebouncedSearch(debouncedSearch);
    if (debouncedSearch.length > 0) {
      setIsReposExpanded(true);
    }
  }

  const repoSearch =
    isOpening || search.trim().length === 0 ? undefined : debouncedSearch || undefined;

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } =
    trpc.repo.getSlim.useInfiniteQuery(
      {
        limit: 5,
        search: repoSearch,
      },
      {
        enabled: open,
        getNextPageParam: (lastPage) => lastPage.meta.nextCursor,
        initialCursor: 1,
      },
    );

  const observerTarget = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!hasNextPage || isFetchingNextPage || !isReposExpanded) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry?.isIntersecting) {
          void fetchNextPage();
        }
      },
      { threshold: 0.1 },
    );

    const currentTarget = observerTarget.current;
    if (currentTarget) {
      observer.observe(currentTarget);
    }

    return () => {
      if (currentTarget) {
        observer.unobserve(currentTarget);
      }
    };
  }, [hasNextPage, isFetchingNextPage, fetchNextPage, isReposExpanded]);

  const navigate = (path: string) => {
    setOpen(false);
    router.push(path);
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
          (item.label.toLowerCase().includes(s) || item.url?.toLowerCase().includes(s)) ?? false,
      );

  return (
    <>
      <AppTooltip className="lg:hidden" content="Search site">
        <AppButton
          aria-label="Search site"
          className={cn(
            "relative size-9 justify-start rounded-xl not-lg:border-0 not-lg:p-0 font-normal text-muted-foreground text-sm lg:w-64 lg:border-border lg:bg-surface-hover lg:pr-12",
          )}
          onClick={() => setOpen(true)}
          variant="outline"
        >
          <Search className="absolute top-2.25 left-2.25" />

          <span className="hidden lg:inline-flex lg:pl-4">{t("command_search")}</span>
          <CommandShortcut className="absolute top-1.5 right-3 hidden text-xs lg:flex">
            Ctrl+K
          </CommandShortcut>
        </AppButton>
      </AppTooltip>

      <CommandDialog onOpenChange={setOpen} open={open} shouldFilter={false}>
        <CommandInput
          isLoading={isLoading}
          onValueChange={setSearch}
          placeholder={t("command_placeholder")}
          value={search}
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
                    className={cn(
                      isDestructive &&
                        "text-destructive data-[selected=true]:bg-destructive/10 data-[selected=true]:text-destructive",
                      "flex items-center justify-between",
                    )}
                    key={item.label}
                    onSelect={() => runCommand(item)}
                    value={item.label}
                  >
                    <div className="flex items-center gap-2">
                      {item.icon != null && <item.icon />}
                      <span>{item.label}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      {item.url != null && (
                        <kbd className="px-1.5 py-0.5 text-muted-foreground text-xs">
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
                <AppButton
                  className="cursor-pointer bg-transparent text-muted-foreground"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setIsReposExpanded(!isReposExpanded);
                  }}
                  size="sm"
                  variant="ghost"
                >
                  {isReposExpanded ? t("command_collapse") : t("command_expand")}
                  <ChevronDown
                    className={cn(
                      "transition-standard transition-transform",
                      isReposExpanded && "rotate-180",
                    )}
                  />
                </AppButton>
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
                      onSelect={() => navigate(`/dashboard/repo/${repo.owner}/${repo.name}`)}
                      value={`${repo.owner}/${repo.name}`}
                    >
                      <AppAvatar
                        alt={`${repo.owner}/${repo.name}`}
                        fallbackText={repo.owner}
                        sizeClassName="size-8"
                        src={repo.avatar}
                      />
                      <div className="line-clamp-1 flex">
                        <span className="truncate font-bold text-muted-foreground">
                          {repo.owner}
                        </span>
                        <span className="text-muted-foreground">/</span>
                        <span className="truncate font-bold">{repo.name}</span>
                      </div>
                    </CommandItem>
                  ))}
                {hasNextPage && (
                  <div className="my-2 flex items-center justify-center" ref={observerTarget}>
                    {isFetchingNextPage && <Spinner />}
                  </div>
                )}
              </>
            )}
          </CommandGroup>

          {!isLoading && data?.pages[0]?.meta.totalCount === 0 && (
            <div className="p-4 text-center text-muted-foreground text-xs">
              {t("repo_empty_title")}
            </div>
          )}
        </CommandList>
      </CommandDialog>
    </>
  );
}
