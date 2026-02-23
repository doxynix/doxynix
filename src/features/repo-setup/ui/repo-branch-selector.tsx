import React, { useState } from "react";
import { Check, ChevronDown, GitBranch } from "lucide-react";

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

type RepoBranchSelectorProps = {
  branches: string[] | undefined;
  defaultBranch: string;
  onSelect: (branch: string) => void;
  selectedBranch: string;
};

export function RepoBranchSelector({
  branches,
  defaultBranch,
  onSelect,
  selectedBranch,
}: Readonly<RepoBranchSelectorProps>) {
  const [open, setOpen] = useState(false);

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
            <GitBranch className="h-3 w-3 shrink-0" />
            {selectedBranch || "Select branch..."}
          </div>
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-75 p-0">
        <Command>
          <CommandInput placeholder="Search branch..." />
          <CommandList className="max-h-75">
            <CommandEmpty>No branch found.</CommandEmpty>
            <CommandGroup>
              {branches?.map((b) => (
                <CommandItem
                  key={b}
                  value={b}
                  onSelect={(currentValue) => {
                    onSelect(currentValue);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn("h-4 w-4", selectedBranch === b ? "opacity-100" : "opacity-0")}
                  />
                  {b}
                  {defaultBranch === b && (
                    <span className="flex items-center gap-1 rounded-md border px-1 py-0.5 text-xs">
                      default
                    </span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
