"use client";

import { BannedEmailReason } from "@doxynix/shared";
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

import { bannedEmailParsers } from "../model/banned-email-parsers";

export function AdminBannedEmailsToolbar() {
  const t = useTranslations("AdminBannedEmails");
  const tCommon = useTranslations("Common");

  const [filters, setFilters] = useQueryStates(bannedEmailParsers);

  const hasFilters = filters.reason !== null || filters.search !== "";

  const update = (value: keyof typeof BannedEmailReason | null) => {
    void setFilters({ page: null, reason: value });
  };

  const reset = () => {
    void setFilters({ page: null, reason: null, search: null });
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <AppSearch placeholder={t("filter_search_placeholder")} />
      <AppListDateFilter parsers={bannedEmailParsers} />

      <Select
        onValueChange={(value) =>
          update(value === "all" ? null : (value as keyof typeof BannedEmailReason))
        }
        value={filters.reason ?? "all"}
      >
        <SelectTrigger
          aria-label={t("filter_reason")}
          className="w-40"
        >
          <SelectValue placeholder={t("filter_reason")} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t("filter_all")}</SelectItem>
          {Object.keys(BannedEmailReason).map((reason) => (
            <SelectItem
              key={reason}
              value={reason}
            >
              {t(`reason_${reason.toLowerCase()}`)}
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
