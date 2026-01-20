"use client";

import type { Route } from "next";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Status, Visibility } from "@prisma/client";
import { X } from "lucide-react";

import { parseRepoSearchParams, REPO_DEFAULTS } from "@/shared/lib/search-params";
import { Button } from "@/shared/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";

export function RepoFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const paramsObject = Object.fromEntries(searchParams.entries());

  const filters = parseRepoSearchParams(paramsObject);

  const hasFilters = searchParams.toString().length > 0;

  const updateQuery = (name: string, value: string) => {
    const newParams = new URLSearchParams(searchParams.toString());

    if (value === "all" || (name === "sortBy" && value === REPO_DEFAULTS.SORT_BY)) {
      newParams.delete(name);
    } else {
      newParams.set(name, value);
    }

    newParams.delete("page");
    router.push(`${pathname}?${newParams.toString()}` as Route);
  };

  const handleReset = () => {
    if (!hasFilters && filters.page === 1) return;
    router.push(pathname as Route);
  };

  return (
    <div className="flex items-center justify-between">
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Select value={filters.status ?? "all"} onValueChange={(v) => updateQuery("status", v)}>
          <SelectTrigger className="w-35">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value={Status.DONE}>Done</SelectItem>
            <SelectItem value={Status.PENDING}>In progress</SelectItem>
            <SelectItem value={Status.FAILED}>Failed</SelectItem>
            <SelectItem value={Status.NEW}>New</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={filters.visibility ?? "all"}
          onValueChange={(v) => updateQuery("visibility", v)}
        >
          <SelectTrigger className="w-32.5">
            <SelectValue placeholder="Visibility" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All visibility</SelectItem>
            <SelectItem value={Visibility.PUBLIC}>Public</SelectItem>
            <SelectItem value={Visibility.PRIVATE}>Private</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filters.sortBy} onValueChange={(v) => updateQuery("sortBy", v)}>
          <SelectTrigger className="w-37.5">
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="updatedAt">Updated</SelectItem>
            <SelectItem value="createdAt">Created</SelectItem>
            <SelectItem value="name">Name</SelectItem>
          </SelectContent>
        </Select>

        <Button disabled={!hasFilters} variant="outline" onClick={handleReset} className="px-2">
          Reset
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
