"use client";

import { useState } from "react";
import { format, subDays, subHours, subMinutes } from "date-fns";
import { Clock } from "lucide-react";
import { useTranslations } from "next-intl";
import { useQueryStates } from "nuqs";
import type { DateRange } from "react-day-picker";

import { AppDateRange } from "@/shared/ui/kit/app-date-range";

import { dashboardParsers } from "@/features/repo-analytics/model/dashboard-parsers";

import { hasUrlStateChanged, resolveDateRange } from "../model/date-range";

const DATE_PERIODS = [
  {
    getValue: () => ({ from: subMinutes(new Date(), 15), to: new Date() }),
    key: "15m",
    labelKey: "last_15m",
  },
  {
    getValue: () => ({ from: subHours(new Date(), 1), to: new Date() }),
    key: "1h",
    labelKey: "last_1h",
  },
  {
    getValue: () => ({ from: subDays(new Date(), 1), to: new Date() }),
    key: "24h",
    labelKey: "last_24h",
  },
  {
    getValue: () => ({ from: subDays(new Date(), 7), to: new Date() }),
    key: "7d",
    labelKey: "last_7d",
  },
  {
    getValue: () => ({ from: subDays(new Date(), 30), to: new Date() }),
    key: "30d",
    labelKey: "last_30d",
  },
  {
    getValue: () => ({ from: subDays(new Date(), 90), to: new Date() }),
    key: "90d",
    labelKey: "last_90d",
  },
] as const;

export function DashboardDatePeriod() {
  const t = useTranslations("Dashboard");
  const [urlState, setUrlState] = useQueryStates(dashboardParsers);

  const [tempDate, setTempDate] = useState<DateRange | undefined>(() =>
    resolveDateRange(urlState.from, urlState.to, urlState.period, DATE_PERIODS),
  );

  const [prevUrlState, setPrevUrlState] = useState(urlState);

  const isUrlChanged = hasUrlStateChanged(prevUrlState, urlState);

  if (isUrlChanged) {
    setPrevUrlState(urlState);
    setTempDate(resolveDateRange(urlState.from, urlState.to, urlState.period, DATE_PERIODS));
  }

  const activePeriod = DATE_PERIODS.find((p) => p.key === urlState.period);

  const handleChange = (newDate: DateRange | undefined) => {
    setTempDate(newDate);
    const from = newDate?.from;
    const to = newDate?.to;
    if (from != null && to != null) {
      const matched = DATE_PERIODS.find((p) => {
        const v = p.getValue();
        return (
          Math.abs(v.from.getTime() - from.getTime()) < 60_000 &&
          Math.abs(v.to.getTime() - to.getTime()) < 60_000
        );
      });
      if (matched) {
        void setUrlState({ from: null, period: matched.key, to: null });
        return;
      }
      void setUrlState({ from, period: "custom", to });
      return;
    }
    void setUrlState({ from: null, period: null, to: null });
  };

  return (
    <AppDateRange
      emptyLabel={t("select_period")}
      onChange={handleChange}
      presets={DATE_PERIODS}
      selected={tempDate}
      selectedPresetKey={activePeriod?.key ?? null}
      triggerIcon={<Clock />}
      triggerLabel={
        activePeriod
          ? t(activePeriod.key)
          : urlState.from && urlState.to
            ? `${format(urlState.from, "dd MMM")} - ${format(urlState.to, "dd MMM, yyyy")}`
            : undefined
      }
    />
  );
}
