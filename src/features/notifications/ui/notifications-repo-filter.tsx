"use client";

import { useState } from "react";
import { Book, Check, ChevronDown } from "lucide-react";
import { useQueryStates } from "nuqs";

import { trpc } from "@/shared/api/trpc";
import { cn } from "@/shared/lib/utils";
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
import { useCreateRepoDialogStore } from "@/entities/repo";

export function NotificationsRepoFilter() {
  const [filters, setFilters] = useQueryStates(notificationsParsers, { shallow: true });
  const { openDialog } = useCreateRepoDialogStore();

  const [open, setOpen] = useState(false);

  const { data: repos, isLoading } = trpc.repo.getSlim.useQuery(
    {},
    {
      enabled: open || (filters.owner != null && filters.repo != null),
    }
  );

  const handleRepoSelect = (r: { name: string; owner: string } | null) => {
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
        <Button role="combobox" variant="outline" className="cursor-pointer justify-between">
          <div className="flex w-60 items-center gap-2 truncate">
            <Book className="h-4 w-4 shrink-0 opacity-50" />
            <span className="truncate">{label}</span>
          </div>
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="p-0">
        <Command>
          <CommandInput placeholder="Search repository..." />
          <CommandList>
            <CommandEmpty>No repository found.</CommandEmpty>
            <CommandGroup>
              <CommandItem onSelect={() => handleRepoSelect(null)} className="cursor-pointer">
                <Check
                  className={cn(
                    "mr-1 h-4 w-4",
                    filters.owner == null ? "opacity-100" : "opacity-0"
                  )}
                />
                All repositories
              </CommandItem>
              {isLoading && (
                <div className="flex flex-col gap-2 p-2">
                  {Array.from({ length: 5 }).map((_, j) => (
                    <Skeleton key={j} className="h-6 w-full" />
                  ))}
                </div>
              )}
              {(repos?.length === 0 || repos == null) && !isLoading ? (
                <div className="flex flex-col items-center gap-4 p-4 text-center text-sm">
                  <p>Repositories not found</p>
                  <Button size="sm" onClick={() => openDialog()} className="w-fit cursor-pointer">
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
                        "mr-2 h-4 w-4",
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
