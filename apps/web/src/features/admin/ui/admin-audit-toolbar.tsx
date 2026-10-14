"use client";

import { AuditModel, AuditOperation } from "@doxynix/shared";
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

import { adminAuditParsers } from "@/entities/audit-log/model/audit-parsers";

export function AdminAuditToolbar() {
  const t = useTranslations("AdminAudit");
  const tCommon = useTranslations("Common");

  const [filters, setFilters] = useQueryStates(adminAuditParsers);

  const hasFilters = filters.model !== null || filters.operation !== null || filters.search !== "";

  const update = (key: "model" | "operation", value: null | string) => {
    void setFilters({ [key]: value, page: null });
  };

  const reset = () => {
    void setFilters({ model: null, operation: null, page: null, search: null });
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <AppSearch placeholder={t("filter_search_placeholder")} />
      <AppListDateFilter parsers={adminAuditParsers} />

      <Select
        onValueChange={(v) => update("model", v === "all" ? null : v)}
        value={filters.model ?? "all"}
      >
        <SelectTrigger
          aria-label={t("filter_model")}
          className="w-44"
        >
          <SelectValue placeholder={t("filter_model")} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t("filter_all")}</SelectItem>
          {Object.values(AuditModel).map((model) => (
            <SelectItem
              key={model}
              value={model}
            >
              {t(`model_${model.toLowerCase()}`)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        onValueChange={(v) => update("operation", v === "all" ? null : v)}
        value={filters.operation ?? "all"}
      >
        <SelectTrigger
          aria-label={t("filter_operation")}
          className="w-36"
        >
          <SelectValue placeholder={t("filter_operation")} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t("filter_all")}</SelectItem>
          {Object.values(AuditOperation).map((operation) => (
            <SelectItem
              key={operation}
              value={operation}
            >
              {t(`operation_${operation.toLowerCase()}`)}
            </SelectItem>
          ))}
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
