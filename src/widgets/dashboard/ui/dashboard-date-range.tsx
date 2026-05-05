"use client";

import { useState } from "react";
import { format, subDays, subHours, subMinutes } from "date-fns";
import { Check, Clock } from "lucide-react";
import { useQueryStates } from "nuqs";
import type { DateRange } from "react-day-picker";

import { cn } from "@/shared/lib/cn";
import { Button } from "@/shared/ui/core/button";
import { Calendar } from "@/shared/ui/core/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/core/popover";

import { dashboardParsers } from "../model/dashboard-parsers";

const DATE_PERIODS = [
  {
    getValue: () => ({ from: subMinutes(new Date(), 15), to: new Date() }),
    label: "Last 15 mins",
    period: "15m",
  },
  {
    getValue: () => ({ from: subHours(new Date(), 1), to: new Date() }),
    label: "Last 1 hour",
    period: "1h",
  },
  {
    getValue: () => ({ from: subDays(new Date(), 1), to: new Date() }),
    label: "Last 24 hours",
    period: "24h",
  },
  {
    getValue: () => ({ from: subDays(new Date(), 7), to: new Date() }),
    label: "Last 7 days",
    period: "7d",
  },
  {
    getValue: () => ({ from: subDays(new Date(), 30), to: new Date() }),
    label: "Last 30 days",
    period: "30d",
  },
  {
    getValue: () => ({ from: subDays(new Date(), 90), to: new Date() }),
    label: "Last 90 days",
    period: "90d",
  },
] as const;

export function DashboardDatePeriod() {
  const [urlState, setUrlState] = useQueryStates(dashboardParsers);

  const getRangeFromUrl = () => {
    if (urlState.from && urlState.to) return { from: urlState.from, to: urlState.to };
    return DATE_PERIODS.find((p) => p.period === urlState.period)?.getValue();
  };

  const [tempDate, setTempDate] = useState<DateRange | undefined>(getRangeFromUrl);

  const [prevUrlState, setPrevUrlState] = useState(urlState);

  const isUrlChanged =
    urlState.from?.getTime() !== prevUrlState.from?.getTime() ||
    urlState.to?.getTime() !== prevUrlState.to?.getTime() ||
    urlState.period !== prevUrlState.period;

  if (isUrlChanged) {
    setPrevUrlState(urlState);
    setTempDate(getRangeFromUrl());
  }

  const activePeriod = DATE_PERIODS.find((p) => p.period === urlState.period);

  const handlePeriodClick = (p: (typeof DATE_PERIODS)[number]) => {
    const values = p.getValue();
    setTempDate(values);
    void setUrlState({ from: null, period: p.period, to: null });
  };

  const handleCustomSelect = (newDate: DateRange | undefined) => {
    setTempDate(newDate);
    if (newDate?.from && newDate.to) {
      void setUrlState({ from: newDate.from, period: "custom", to: newDate.to });
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className="bg-background">
          <Clock />
          {activePeriod ? (
            activePeriod.label
          ) : urlState.from && urlState.to ? (
            <>
              {format(urlState.from, "dd MMM")} - {format(urlState.to, "dd MMM, yyyy")}
            </>
          ) : (
            "Select Period"
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-auto p-0">
        <div className="flex">
          <div className="flex w-40 flex-col p-2">
            <p className="text-muted-foreground px-2 py-1.5 text-center text-xs">Quick Range</p>
            <div className="space-y-1">
              {DATE_PERIODS.map((p) => (
                <Button
                  key={p.period}
                  size="sm"
                  variant="ghost"
                  onClick={() => handlePeriodClick(p)}
                  className={cn(
                    "flex w-full items-center justify-between",
                    urlState.period === p.period &&
                      "bg-primary text-primary-foreground hover:bg-primary/90"
                  )}
                >
                  {p.label}
                  {urlState.period === p.period && <Check />}
                </Button>
              ))}
            </div>
          </div>

          <div className="flex flex-col border-l">
            <div className="flex gap-4 border-b p-3 text-center">
              <div className="flex-1 space-y-1">
                <span className="text-xs">Start Date</span>
                <div className="text-xs">
                  {tempDate?.from ? format(tempDate.from, "yyyy-MM-dd") : "YYYY-MM-DD"}
                </div>
              </div>
              <div className="flex-1 space-y-1">
                <span className="text-xs">End Date</span>
                <div className="text-xs">
                  {tempDate?.to ? format(tempDate.to, "yyyy-MM-dd") : "YYYY-MM-DD"}
                </div>
              </div>
            </div>
            <Calendar
              key={urlState.period}
              defaultMonth={tempDate?.from}
              mode="range"
              numberOfMonths={2}
              selected={tempDate}
              onSelect={handleCustomSelect}
              className="p-3"
            />
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
