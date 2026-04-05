"use client";

import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useQueryStates } from "nuqs";

import { Button } from "@/shared/ui/core/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/core/select";

import { repoParsers } from "@/entities/repo";

import { StatusSchema, VisibilitySchema } from "@/generated/zod";

export function RepoFilters() {
  const tCommon = useTranslations("Common");
  const t = useTranslations("Dashboard");

  const [filters, setFilters] = useQueryStates(repoParsers, {
    shallow: true,
  });

  const hasFilters =
    filters.status !== null || filters.visibility !== null || filters.sortBy !== "updatedAt";

  const handleUpdate = (key: keyof typeof repoParsers, value: string | number | null) => {
    void setFilters({
      [key]: value,
      page: null,
    });
  };

  const handleReset = () => {
    void setFilters({
      page: null,
      sortBy: null,
      status: null,
      visibility: null,
    });
  };

  return (
    <div className="flex items-center justify-between">
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Select
          value={filters.status ?? "all"}
          onValueChange={(v) => handleUpdate("status", v === "all" ? null : v)}
        >
          <SelectTrigger aria-label={tCommon("status")} className="w-35">
            <SelectValue placeholder={tCommon("status")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("repo_status_all")}</SelectItem>
            <SelectItem value={StatusSchema.enum.DONE}>{tCommon("done")}</SelectItem>
            <SelectItem value={StatusSchema.enum.PENDING}>{t("repo_in_progress")}</SelectItem>
            <SelectItem value={StatusSchema.enum.FAILED}>{tCommon("failed")}</SelectItem>
            <SelectItem value={StatusSchema.enum.NEW}>{tCommon("new")}</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={filters.visibility ?? "all"}
          onValueChange={(v) => handleUpdate("visibility", v === "all" ? null : v)}
        >
          <SelectTrigger aria-label={tCommon("visibility")} className="w-32.5">
            <SelectValue placeholder={tCommon("visibility")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("repo_visibility_all")}</SelectItem>
            <SelectItem value={VisibilitySchema.enum.PUBLIC}>{tCommon("public")}</SelectItem>
            <SelectItem value={VisibilitySchema.enum.PRIVATE}>{tCommon("private")}</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filters.sortBy} onValueChange={(v) => handleUpdate("sortBy", v)}>
          <SelectTrigger aria-label={t("repo_sort_by")} className="w-37.5">
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
          <X className="size-4" />
        </Button>
      </div>
    </div>
  );
}
