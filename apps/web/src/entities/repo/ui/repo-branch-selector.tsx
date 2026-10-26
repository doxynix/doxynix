"use client";

import { Check, ChevronDown, GitBranch } from "lucide-react";
import { useTranslations } from "next-intl";

import { cn } from "@/shared/lib/cn";
import { AppBadge } from "@/shared/ui/core/badge";
import { AppButton } from "@/shared/ui/core/button";
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
import { SkeletonList, SkeletonText } from "@/shared/ui/kit/app-skeleton";

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
  const t = useTranslations("Dashboard");
  const open = useRepoBranchOpen();
  const { setOpen } = useRepoBranchActions();

  return (
    <Popover
      onOpenChange={setOpen}
      open={open}
    >
      <PopoverTrigger asChild>
        <AppButton
          aria-expanded={open}
          aria-haspopup="listbox"
          className="w-full justify-between font-normal"
          variant="outline"
        >
          <div className="flex items-center gap-2 truncate">
            <GitBranch className="size-3" />
            {selectedBranch || t("repo_branch_placeholder")}
          </div>
          <ChevronDown className="ml-2 opacity-50" />
        </AppButton>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="p-0"
      >
        <Command>
          <CommandInput placeholder={t("repo_branch_search")} />
          <CommandList>
            {!isLoading && (branches?.length ?? 0) > 0 && (
              <CommandEmpty>{t("repo_branch_no_branch_found")}</CommandEmpty>
            )}
            <CommandGroup>
              {isLoading && (
                <SkeletonList
                  className="flex flex-col"
                  count={5}
                  itemClassName="flex items-center gap-2 px-2 py-1.5"
                  renderItem={(index) => (
                    <>
                      <Skeleton className="size-4 shrink-0" />
                      <SkeletonText
                        className="min-w-0 flex-1"
                        lines={1}
                        widths={["w-32"]}
                      />
                      {index === 0 && (
                        <SkeletonText
                          className="ml-auto"
                          lines={1}
                          size="sm"
                          widths={["w-24"]}
                        />
                      )}
                    </>
                  )}
                />
              )}
              {(branches?.length === 0 || branches == null) && !isLoading ? (
                <p>{t("repo_branch_not_found")}</p>
              ) : (
                branches?.map((b) => (
                  <CommandItem
                    key={b}
                    onSelect={(currentValue) => {
                      onSelect(currentValue);
                      setOpen(false);
                    }}
                    value={b}
                  >
                    <Check className={cn(selectedBranch === b ? "opacity-100" : "opacity-0")} />
                    {b}
                    {defaultBranch === b && (
                      <AppBadge variant="outline">{t("repo_branch_default")}</AppBadge>
                    )}
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
