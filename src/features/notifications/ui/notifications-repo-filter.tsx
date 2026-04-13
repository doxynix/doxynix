"use client";

import { useState } from "react";
import { Book, Check, ChevronDown } from "lucide-react";
import { useQueryStates } from "nuqs";

import { trpc } from "@/shared/api/trpc";
import { cn } from "@/shared/lib/cn";
import { Button } from "@/shared/ui/core/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/shared/ui/core/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/core/popover";
import { Skeleton } from "@/shared/ui/core/skeleton";

import { notificationsParsers } from "@/entities/notifications";
import { useCreateRepoActions } from "@/entities/repo";

export function NotificationsRepoFilter() {
  const [filters, setFilters] = useQueryStates(notificationsParsers, { shallow: true });
  const { setOpen: setOpenCreateDialog } = useCreateRepoActions();

  const [open, setOpen] = useState(false);

  const { data: repos, isLoading } = trpc.repo.getSlim.useQuery(
    {},
    {
      enabled: open || (filters.owner != null && filters.repo != null),
    }
  );

  const handleRepoSelect = (r: null | { name: string; owner: string }) => {
    void setFilters({
      owner: r?.owner ?? null,
      page: null,
      repo: r?.name ?? null,
    });
    setOpen(false);
  };

  const selectedRepo = repos?.find((r) => r.owner === filters.owner && r.name === filters.repo);

  const label = selectedRepo ? `${selectedRepo.owner}/${selectedRepo.name}` : "All repositories";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          aria-expanded={open}
          aria-haspopup="listbox"
          className="cursor-pointer justify-between"
        >
          <div className="flex w-60 items-center gap-2 truncate">
            <Book className="size-4 shrink-0 opacity-50" />
            <span className="truncate">{label}</span>
          </div>
          <ChevronDown className="ml-2 size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="p-0">
        <Command>
          <CommandInput placeholder="Search repository..." />
          <CommandList>
            <CommandEmpty>
              {repos?.length === 0 || repos == null ? null : "No repository found"}
            </CommandEmpty>
            <CommandGroup>
              <CommandItem onSelect={() => handleRepoSelect(null)} className="cursor-pointer">
                <Check
                  className={cn("mr-1 size-4", filters.owner == null ? "opacity-100" : "opacity-0")}
                />
                All repositories
              </CommandItem>
              {isLoading && (
                <div className="flex flex-col gap-2 p-2">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-6 w-full" />
                  ))}
                </div>
              )}
              {(repos?.length === 0 || repos == null) && !isLoading ? (
                <div className="flex flex-col items-center gap-4 p-4 text-center text-sm">
                  <p>Repositories not found</p>
                  <Button
                    size="sm"
                    onClick={() => {
                      setOpen(false);
                      setOpenCreateDialog(true);
                    }}
                    className="w-fit cursor-pointer"
                  >
                    Add
                  </Button>
                </div>
              ) : (
                repos?.map((r) => (
                  <CommandItem
                    key={r.id}
                    value={`${r.owner}/${r.name}`}
                    onSelect={() => handleRepoSelect(r)}
                    className="cursor-pointer"
                  >
                    <Check
                      className={cn(
                        "mr-2 size-4",
                        filters.repo === r.name && filters.owner === r.owner
                          ? "opacity-100"
                          : "opacity-0"
                      )}
                    />
                    <span className="truncate">
                      {r.owner}/{r.name}
                    </span>
                  </CommandItem>
                ))
              )}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
