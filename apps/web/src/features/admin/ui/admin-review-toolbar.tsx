"use client";

import { FixStatus, PRAnalysisStatus } from "@doxynix/shared";
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

import { adminReviewParsers, RISK_LEVELS } from "../model/admin-review-parsers";

export function AdminReviewToolbar() {
  const t = useTranslations("AdminReview");
  const tCommon = useTranslations("Common");

  const [filters, setFilters] = useQueryStates(adminReviewParsers);

  const hasFilters =
    filters.status !== null ||
    filters.fixStatus !== null ||
    filters.minRiskScore !== null ||
    filters.search !== "";

  const update = (key: "fixStatus" | "minRiskScore" | "status", value: null | string) => {
    void setFilters({ [key]: value, page: null });
  };

  const reset = () => {
    void setFilters({
      fixStatus: null,
      minRiskScore: null,
      page: null,
      search: null,
      status: null,
    });
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <AppSearch placeholder={t("filter_search_placeholder")} />
      <AppListDateFilter parsers={adminReviewParsers} />

      <Select
        onValueChange={(v) => update("status", v === "all" ? null : v)}
        value={filters.status ?? "all"}
      >
        <SelectTrigger
          aria-label={t("filter_status")}
          className="w-36"
        >
          <SelectValue placeholder={t("filter_status")} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t("filter_all")}</SelectItem>
          {Object.values(PRAnalysisStatus).map((status) => (
            <SelectItem
              key={status}
              value={status}
            >
              {t(`status_${status.toLowerCase()}`)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        onValueChange={(v) => update("minRiskScore", v === "all" ? null : v)}
        value={filters.minRiskScore ?? "all"}
      >
        <SelectTrigger
          aria-label={t("filter_risk")}
          className="w-32"
        >
          <SelectValue placeholder={t("filter_risk")} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t("filter_all")}</SelectItem>
          {RISK_LEVELS.map((risk) => (
            <SelectItem
              key={risk}
              value={String(risk)}
            >
              {t("filter_risk_at_least", { score: risk })}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        onValueChange={(v) => update("fixStatus", v === "all" ? null : v)}
        value={filters.fixStatus ?? "all"}
      >
        <SelectTrigger
          aria-label={t("filter_fix_status")}
          className="w-40"
        >
          <SelectValue placeholder={t("filter_fix_status")} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t("filter_all")}</SelectItem>
          {Object.values(FixStatus).map((status) => (
            <SelectItem
              key={status}
              value={status}
            >
              {t(`fix_status_${status.toLowerCase()}`)}
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
