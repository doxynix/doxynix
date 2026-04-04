import { Check, ChevronDown, GitBranch } from "lucide-react";

import { cn } from "@/shared/lib/utils";
import { Badge } from "@/shared/ui/core/badge";
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

import { useRepoBranchActions, useRepoBranchOpen } from "../model/use-repo-branch.store";

type Props = {
  branches: string[] | undefined;
  defaultBranch: string;
  isLoading: boolean;
  onSelect: (branch: string) => void;
  selectedBranch: string;
};

export function RepoBranchSelector({
  branches,
  defaultBranch,
  isLoading,
  onSelect,
  selectedBranch,
}: Readonly<Props>) {
  const open = useRepoBranchOpen();
  const { setOpen } = useRepoBranchActions();

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          role="combobox"
          variant="outline"
          aria-expanded={open}
          className="w-full justify-between font-normal"
        >
          <div className="flex items-center gap-2 truncate">
            <GitBranch className="size-3 shrink-0" />
            {selectedBranch || "Select branch..."}
          </div>
          <ChevronDown className="ml-2 size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="p-0">
        <Command>
          <CommandInput placeholder="Search branch..." />
          <CommandList>
            {!isLoading && (branches?.length ?? 0) > 0 && (
              <CommandEmpty>No branch found</CommandEmpty>
            )}
            <CommandGroup>
              {isLoading && (
                <div className="flex flex-col gap-2 p-2">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-6 w-full" />
                  ))}
                </div>
              )}
              {(branches?.length === 0 || branches == null) && !isLoading ? (
                <p>Branches not found</p>
              ) : (
                branches?.map((b) => (
                  <CommandItem
                    key={b}
                    value={b}
                    onSelect={(currentValue) => {
                      onSelect(currentValue);
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn("size-4", selectedBranch === b ? "opacity-100" : "opacity-0")}
                    />
                    {b}
                    {defaultBranch === b && <Badge variant="outline">default</Badge>}
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
