"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronDown,
  CreditCard,
  FolderGit2,
  KeyRound,
  LayoutGrid,
  Search,
  Settings,
  User,
} from "lucide-react";
import { useHotkeys } from "react-hotkeys-hook";
import { useDebounce } from "use-debounce";

import { trpc } from "@/shared/api/trpc";
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
    router.push(path);
  };

  const runCommand = useCallback((command: () => unknown) => {
    setOpen(false);
    command();
  }, []);

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

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput
          value={search}
          onValueChange={setSearch}
          placeholder="Введите команду или название репозитория..."
        />
        <CommandList>
          <CommandEmpty>Ничего не найдено.</CommandEmpty>

          <CommandGroup heading="Навигация">
            <CommandItem onSelect={() => runCommand(() => router.push("/dashboard"))}>
              <LayoutGrid className="mr-2 h-4 w-4" />
              <span>Обзор</span> <CommandShortcut>Alt+O</CommandShortcut>
            </CommandItem>
            <CommandItem onSelect={() => runCommand(() => router.push("/repo"))}>
              <FolderGit2 className="mr-2 h-4 w-4" />
              <span>Репозитории</span> <CommandShortcut>Alt+R</CommandShortcut>
            </CommandItem>
            <CommandItem onSelect={() => runCommand(() => router.push("/settings"))}>
              <Settings className="mr-2 h-4 w-4" />
              <span>Настройки</span>
              <CommandShortcut>Alt+S</CommandShortcut>
            </CommandItem>
          </CommandGroup>

          <CommandSeparator />

          <CommandGroup heading="Прочее">
            <CommandItem onSelect={() => runCommand(() => router.push("/settings?tab=profile"))}>
              <User className="mr-2 h-4 w-4" />
              <span>Профиль</span>
              <CommandShortcut>Alt+P</CommandShortcut>
            </CommandItem>
            <CommandItem onSelect={() => runCommand(() => router.push("/settings?tab=billing"))}>
              <CreditCard className="mr-2 h-4 w-4" />
              <span>Биллинг</span>
              <CommandShortcut>Alt+B</CommandShortcut>
            </CommandItem>
            <CommandItem onSelect={() => runCommand(() => router.push("/settings?tab=api-keys"))}>
              <KeyRound className="mr-2 h-4 w-4" />
              <span>API ключи</span>
              <CommandShortcut>Alt+A</CommandShortcut>
            </CommandItem>
          </CommandGroup>
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
            {isLoading && (
              <div className="p-4 text-center">
                <Spinner className="inline h-4 w-4" />
              </div>
            )}
            {isReposExpanded && (
              <>
                {data?.pages
                  .flatMap((p) => p.items)
                  .map((repo) => (
                    <CommandItem
                      key={repo.id}
                      value={`${repo.owner}/${repo.name}`}
                      onSelect={() => navigate(`/repo/${repo.owner}/${repo.name}`)}
                    >
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

          {!isLoading && data?.pages[0]?.items.length === 0 && (
            <div className="text-muted-foreground px-4 py-2 text-xs">Нет репозиториев</div>
          )}
        </CommandList>
      </CommandDialog>
    </>
  );
}
