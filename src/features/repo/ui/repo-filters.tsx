"use client";

import type { Route } from "next";
import { useSearchParams } from "next/navigation";
import { Status, Visibility } from "@prisma/client";
import { X } from "lucide-react";
import { useTranslations } from "next-intl";

import { parseRepoSearchParams, REPO_DEFAULTS } from "@/shared/lib/search-params";
import { Button } from "@/shared/ui/core/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/core/select";

import { usePathname, useRouter } from "@/i18n/routing";

export function RepoFilters() {
  const tCommon = useTranslations("Common");
  const t = useTranslations("Dashboard");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const paramsObject = Object.fromEntries(searchParams.entries());

  const filters = parseRepoSearchParams(paramsObject);

  const hasFilters =
    (filters.status != null && (filters.status as string) !== "all") ||
    (filters.visibility != null && (filters.visibility as string) !== "all") ||
    (filters.sortBy != null && filters.sortBy !== REPO_DEFAULTS.SORT_BY);

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
    const newParams = new URLSearchParams(searchParams.toString());

    const searchValue = newParams.get("search");

    newParams.forEach((_, key) => {
      if (key !== "search") newParams.delete(key);
    });

    if (searchValue != null) newParams.set("search", searchValue);

    router.push(`${pathname}?${newParams.toString()}` as Route);
  };

  return (
    <div className="flex items-center justify-between">
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Select value={filters.status ?? "all"} onValueChange={(v) => updateQuery("status", v)}>
          <SelectTrigger className="w-35">
            <SelectValue placeholder={tCommon("status")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("repo_status_all")}</SelectItem>
            <SelectItem value={Status.DONE}>{tCommon("done")}</SelectItem>
            <SelectItem value={Status.PENDING}>{t("repo_in_progress")}</SelectItem>
            <SelectItem value={Status.FAILED}>{tCommon("failed")}</SelectItem>
            <SelectItem value={Status.NEW}>{tCommon("new")}</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={filters.visibility ?? "all"}
          onValueChange={(v) => updateQuery("visibility", v)}
        >
          <SelectTrigger className="w-32.5">
            <SelectValue placeholder={tCommon("visibility")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("repo_visibility_all")}</SelectItem>
            <SelectItem value={Visibility.PUBLIC}>{tCommon("public")}</SelectItem>
            <SelectItem value={Visibility.PRIVATE}>{tCommon("private")}</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filters.sortBy} onValueChange={(v) => updateQuery("sortBy", v)}>
          <SelectTrigger className="w-37.5">
            <SelectValue placeholder={t("repo_sort_by")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="updatedAt">{tCommon("updated")}</SelectItem>
            <SelectItem value="createdAt">{tCommon("created")}</SelectItem>
            <SelectItem value="name">{tCommon("name")}</SelectItem>
          </SelectContent>
        </Select>

        <Button disabled={!hasFilters} variant="outline" onClick={handleReset} className="px-2">
          {tCommon("reset")}
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
