"use client";

import { UserRole } from "@doxynix/shared";
import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useQueryStates } from "nuqs";

import { AppButton } from "@/shared/ui/core/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/core/select";
import { AppListDateFilter } from "@/shared/ui/kit/app-list-date-filter";
import { AppSearch } from "@/shared/ui/kit/app-search";

import { adminUserParsers } from "@/entities/user/model/user-parsers";

export function AdminUsersToolbar() {
  const t = useTranslations("AdminUsers");
  const tCommon = useTranslations("Common");

  const [filters, setFilters] = useQueryStates(adminUserParsers);

  const hasFilters = filters.banned !== null || filters.role !== null || filters.search !== "";

  const update = (key: "banned" | "role", value: null | string) => {
    void setFilters({ [key]: value, page: null });
  };

  const reset = () => {
    void setFilters({ banned: null, page: null, role: null, search: null });
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <AppSearch placeholder={t("filter_search_placeholder")} />
      <AppListDateFilter parsers={adminUserParsers} />

      <Select
        onValueChange={(v) => update("role", v === "all" ? null : v)}
        value={filters.role ?? "all"}
      >
        <SelectTrigger
          aria-label={t("filter_role")}
          className="w-32"
        >
          <SelectValue placeholder={t("filter_role")} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t("filter_all")}</SelectItem>
          <SelectItem value={UserRole.ADMIN}>{t("role_admin")}</SelectItem>
          <SelectItem value={UserRole.USER}>{t("role_user")}</SelectItem>
        </SelectContent>
      </Select>

      <Select
        onValueChange={(v) => update("banned", v === "all" ? null : v)}
        value={filters.banned === null ? "all" : String(filters.banned)}
      >
        <SelectTrigger
          aria-label={t("filter_status")}
          className="w-32"
        >
          <SelectValue placeholder={t("filter_status")} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t("filter_all")}</SelectItem>
          <SelectItem value="false">{t("status_active")}</SelectItem>
          <SelectItem value="true">{t("filter_banned")}</SelectItem>
        </SelectContent>
      </Select>

      <AppButton
        className="px-2"
        disabled={!hasFilters}
        onClick={reset}
        variant="outline"
      >
        {tCommon("reset")}
        <X />
      </AppButton>
    </div>
  );
}
