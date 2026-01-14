"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { Book, ChevronDown, Search } from "lucide-react";
import { useHotkeys } from "react-hotkeys-hook";
import { useDebounce } from "use-debounce";

import { trpc } from "@/shared/api/trpc";
import { dashboardMenu, settingsMenu } from "@/shared/constants/navigation";
import { useNavigationHotkeys } from "@/shared/hooks/use-navigation-hotkeys";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/shared/ui/command";
import { Spinner } from "@/shared/ui/spinner";

export function AppCommandMenu() {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [debouncedSearch] = useDebounce(search, 300);
  const [isReposExpanded, setIsReposExpanded] = useState(true);

  const router = useRouter();
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } =
    trpc.repo.getAll.useInfiniteQuery(
      {
        limit: 10,
        search: debouncedSearch,
      },
      {
        getNextPageParam: (lastPage) => lastPage.meta.nextCursor,
        initialCursor: 1,
        enabled: open,
      }
    );

  const observerTarget = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!hasNextPage || isFetchingNextPage || !isReposExpanded) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
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

  useNavigationHotkeys(() => setOpen(false));

  useHotkeys(
    "mod+k",
    (e) => {
      e.preventDefault();
      setOpen((prev) => !prev);
    },
    { enableOnFormTags: true }
  );

  const navigate = (path: string) => {
    setOpen(false);
    router.push(path as Route);
  };

  const runCommand = useCallback((command: () => unknown) => {
    setOpen(false);
    command();
  }, []);

  const filterItems = (items: typeof dashboardMenu) => {
    if (!search) return items;
    const lowerSearch = search.toLowerCase();
    return items.filter((item) => item.label.toLowerCase().includes(lowerSearch));
  };

  const filteredNav = filterItems(dashboardMenu);
  const filteredSettings = filterItems(settingsMenu);

  return (
    <>
      <Button
        variant="outline"
        className={cn(
          "bg-muted/50 text-muted-foreground relative h-9 w-full justify-start rounded-xl text-sm font-normal shadow-none sm:pr-12 md:w-40 lg:w-64"
        )}
        onClick={() => setOpen(true)}
      >
        <Search className="absolute top-2.25 left-2" />
        <span className="inline-flex pl-4">Поиск по сайту...</span>
        <kbd className="bg-muted absolute top-[0.4rem] right-[0.3rem] flex h-5 items-center rounded border px-1.5">
          <span className="text-xs">Ctrl+K</span>
        </kbd>
      </Button>

      <CommandDialog open={open} onOpenChange={setOpen} shouldFilter={false}>
        <CommandInput
          value={search}
          onValueChange={setSearch}
          isLoading={isLoading}
          placeholder="Введите команду или название репозитория..."
        />
        <CommandList>
          {filteredNav.length === 0 && filteredSettings.length === 0 && (
            <CommandEmpty>Ничего не найдено.</CommandEmpty>
          )}

          {filteredNav.length > 0 && (
            <CommandGroup heading="Навигация">
              {filteredNav.map((item) => (
                <CommandItem
                  key={item.href}
                  value={item.label}
                  onSelect={() => runCommand(() => router.push(item.href as Route))}
                >
                  {item.icon && <item.icon />}
                  <span>{item.label}</span>
                  {item.shortcut !== null && <CommandShortcut>{item.shortcut}</CommandShortcut>}
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          <CommandSeparator />

          {filteredSettings.length > 0 && (
            <CommandGroup heading="Прочее">
              {filteredSettings.map((item) => {
                const isDestructive = item.variant === "destructive";
                return (
                  <CommandItem
                    key={item.href}
                    className={cn(
                      isDestructive &&
                        "text-destructive data-[selected=true]:bg-destructive/10 data-[selected=true]:text-destructive"
                    )}
                    value={item.label}
                    onSelect={() => runCommand(() => router.push(item.href as Route))}
                  >
                    {item.icon && <item.icon />}
                    <span>{item.label}</span>
                    {item.shortcut !== null && <CommandShortcut>{item.shortcut}</CommandShortcut>}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          )}

          <CommandGroup
            heading={
              <div className="flex w-full items-center justify-between">
                <span>Быстрый переход к репозиторию</span>
                <Button
                  className="text-muted-foreground! cursor-pointer bg-transparent! hover:underline"
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setIsReposExpanded(!isReposExpanded);
                  }}
                >
                  {isReposExpanded ? "Свернуть" : "Развернуть"}
                  <ChevronDown
                    className={cn(
                      isReposExpanded && "rotate-180 transition-transform duration-300"
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
                      <span>
                        {repo.owner}/{repo.name}
                      </span>
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
            <div className="text-muted-foreground p-4 text-center text-xs">Нет репозиториев</div>
          )}
        </CommandList>
      </CommandDialog>
    </>
  );
}
