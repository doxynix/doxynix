"use client";

import { subDays } from "date-fns";
import { useLocale, useTranslations } from "next-intl";
import { useQueryStates } from "nuqs";
import type { parseAsInteger, parseAsIsoDate } from "nuqs/server";
import type { DateRange } from "react-day-picker";

import { formatShortDate } from "@/shared/lib/date-utils";
import { AppDateRange } from "@/shared/ui/kit/app-date-range";

const PRESETS = [
  { getValue: () => ({ from: subDays(new Date(), 1), to: new Date() }), key: "last_24h" },
  { getValue: () => ({ from: subDays(new Date(), 7), to: new Date() }), key: "last_7d" },
  { getValue: () => ({ from: subDays(new Date(), 30), to: new Date() }), key: "last_30d" },
  { getValue: () => ({ from: subDays(new Date(), 90), to: new Date() }), key: "last_90d" },
] as const;

type Props = {
  parsers: {
    from: typeof parseAsIsoDate;
    page?: typeof parseAsInteger;
    to: typeof parseAsIsoDate;
  };
};

export function AppListDateFilter({ parsers }: Readonly<Props>) {
  const t = useTranslations("DateRange");
  const locale = useLocale();

  // A cursor list has no page key at all, so it must not gain one from this filter.
  const [urlState, setUrlState] = useQueryStates({
    from: parsers.from,
    ...(parsers.page != null ? { page: parsers.page } : {}),
    to: parsers.to,
  });

  const updateRange = (from: Date | null, to: Date | null) => {
    void setUrlState({
      from,
      ...(parsers.page != null ? { page: null } : {}),
      to,
    });
  };

  const selected: DateRange | undefined =
    urlState.from != null && urlState.to != null
      ? { from: new Date(urlState.from), to: new Date(urlState.to) }
      : undefined;

  const presetKey = PRESETS.find((p) => {
    if (selected?.from == null || selected.to == null) {
      return false;
    }

    const value = p.getValue();
    return (
      Math.abs(value.from.getTime() - selected.from.getTime()) < 60_000 &&
      Math.abs(value.to.getTime() - selected.to.getTime()) < 60_000
    );
  })?.key;

  const triggerLabel =
    presetKey != null
      ? t(presetKey)
      : selected?.from != null && selected.to != null
        ? `${formatShortDate(selected.from, locale)} — ${formatShortDate(selected.to, locale)}`
        : undefined;

  return (
    <AppDateRange
      emptyLabel={t("any_date")}
      onChange={(range) => {
        if (range?.from == null) {
          updateRange(null, null);
          return;
        }

        if (range.to == null) {
          return;
        }

        updateRange(range.from, range.to);
      }}
      presets={PRESETS}
      selected={selected}
      selectedPresetKey={presetKey ?? null}
      triggerLabel={triggerLabel}
    />
  );
}
