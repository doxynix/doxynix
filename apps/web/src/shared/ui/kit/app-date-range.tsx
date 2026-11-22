"use client";

import { type ReactNode, useState } from "react";
import { addMonths, format } from "date-fns";
import { CalendarIcon, Check, ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import type { DateRange } from "react-day-picker";

import { cn } from "@/shared/lib/cn";

import { AppButton } from "../core/button";
import { Calendar } from "../core/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "../core/popover";

export type DateRangePreset = {
  getValue: () => { from: Date; to: Date };
  key: string;
  labelKey?: string;
};
type Props = {
  align?: "center" | "end" | "start";
  emptyLabel?: string;
  onChange: (range: DateRange | undefined) => void;
  presets: readonly DateRangePreset[];
  selected?: DateRange;
  selectedPresetKey?: null | string;
  triggerIcon?: ReactNode;
  triggerLabel?: string;
  variant?: "ghost" | "outline" | "secondary";
};

export function AppDateRange({
  align = "end",
  emptyLabel,
  onChange,
  presets,
  selected,
  selectedPresetKey = null,
  triggerIcon,
  triggerLabel,
  variant = "outline",
}: Readonly<Props>) {
  const t = useTranslations("DateRange");

  const [draft, setDraft] = useState<DateRange | undefined>(selected);
  const [month, setMonth] = useState<Date | undefined>(selected?.from);
  const selectedKey = `${selected?.from?.getTime() ?? ""}|${selected?.to?.getTime() ?? ""}`;
  const [lastSelectedKey, setLastSelectedKey] = useState(selectedKey);

  if (selectedKey !== lastSelectedKey) {
    setLastSelectedKey(selectedKey);
    setDraft(selected);
  }

  function handleChange(range: DateRange | undefined) {
    setDraft(range);
    onChange(range);
  }

  function handlePreset(preset: DateRangePreset) {
    const range = preset.getValue();
    setMonth(range.from);
    handleChange(range);
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <AppButton
          className={cn("shrink-0 gap-2", variant === "outline" && "bg-background")}
          variant={variant}
        >
          <span className="flex items-center [&_svg]:text-muted-foreground">
            {triggerIcon ?? <CalendarIcon />}
          </span>
          {triggerLabel ?? emptyLabel}
        </AppButton>
      </PopoverTrigger>

      <PopoverContent
        align={align}
        className="w-auto max-w-[calc(100vw-2rem)] overflow-x-auto p-0"
      >
        <div className="flex">
          <div className="flex w-44 flex-col p-2">
            <p className="px-2 py-1.5 text-muted-foreground text-xs">{t("quick_range")}</p>
            <div className="flex flex-col gap-1">
              {presets.map((preset) => (
                <PresetButton
                  isActive={selectedPresetKey === preset.key}
                  key={preset.key}
                  label={t(preset.labelKey ?? preset.key)}
                  onClick={() => handlePreset(preset)}
                />
              ))}
            </div>
          </div>

          <div className="flex min-w-0 flex-col border-l">
            <div className="flex items-center gap-1 border-b p-2">
              <AppButton
                aria-label={t("previous_month")}
                className="shrink-0"
                onClick={() => setMonth(addMonths(month ?? new Date(), -2))}
                size="icon-sm"
                variant="ghost"
              >
                <ChevronLeft />
              </AppButton>

              <div className="grid min-w-0 flex-1 grid-cols-2 gap-4 text-center">
                <div className="flex min-w-0 flex-col gap-1">
                  <span className="text-muted-foreground text-xs">{t("start_date")}</span>
                  <span className="truncate text-xs tabular-nums">
                    {draft?.from ? format(draft.from, "yyyy-MM-dd") : "—"}
                  </span>
                </div>
                <div className="flex min-w-0 flex-col gap-1">
                  <span className="text-muted-foreground text-xs">{t("end_date")}</span>
                  <span className="truncate text-xs tabular-nums">
                    {draft?.to ? format(draft.to, "yyyy-MM-dd") : "—"}
                  </span>
                </div>
              </div>

              <AppButton
                aria-label={t("next_month")}
                className="shrink-0"
                onClick={() => setMonth(addMonths(month ?? new Date(), 2))}
                size="icon-sm"
                variant="ghost"
              >
                <ChevronRight />
              </AppButton>
            </div>

            <Calendar
              className="p-3"
              hideNavigation
              mode="range"
              month={month}
              numberOfMonths={2}
              onMonthChange={setMonth}
              onSelect={handleChange}
              selected={draft}
              showOutsideDays={false}
            />

            <div className="border-t p-2">
              <AppButton
                onClick={() => handleChange(undefined)}
                size="sm"
                variant="ghost"
              >
                {t("clear")}
              </AppButton>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function PresetButton({
  isActive,
  label,
  onClick,
}: Readonly<{ isActive: boolean; label: string; onClick: () => void }>) {
  return (
    <AppButton
      className={cn(
        "flex w-full items-center gap-2",
        isActive && "bg-primary text-primary-foreground hover:bg-primary/90",
      )}
      onClick={onClick}
      size="sm"
      variant="ghost"
    >
      <span className="min-w-0 flex-1 truncate text-left">{label}</span>
      {isActive && <Check className="size-3.5 shrink-0" />}
    </AppButton>
  );
}
