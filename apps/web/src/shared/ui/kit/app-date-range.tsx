"use client";

import { useState } from "react";
import { format } from "date-fns";
import { Check } from "lucide-react";
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
  triggerIcon?: React.ReactNode;
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

  return (
    <Popover>
      <PopoverTrigger asChild>
        <AppButton
          className={cn("shrink-0 gap-2", variant === "outline" && "bg-background")}
          variant={variant}
        >
          {triggerIcon}
          {triggerLabel ?? emptyLabel}
        </AppButton>
      </PopoverTrigger>

      <PopoverContent
        align={align}
        className="w-auto p-0"
      >
        <div className="flex">
          <div className="flex w-36 flex-col p-2">
            <p className="px-2 py-1.5 text-muted-foreground text-xs">{t("quick_range")}</p>
            <div className="flex flex-col gap-1">
              {presets.map((preset) => (
                <PresetButton
                  isActive={selectedPresetKey === preset.key}
                  key={preset.key}
                  label={t(preset.labelKey ?? preset.key)}
                  onClick={() => handleChange(preset.getValue())}
                />
              ))}
            </div>
          </div>

          <div className="flex flex-col border-l">
            <div className="flex gap-4 border-b p-3 text-center">
              <div className="flex flex-1 flex-col gap-1">
                <span className="text-muted-foreground text-xs">{t("start_date")}</span>
                <span className="text-xs">
                  {draft?.from ? format(draft.from, "yyyy-MM-dd") : "—"}
                </span>
              </div>
              <div className="flex flex-1 flex-col gap-1">
                <span className="text-muted-foreground text-xs">{t("end_date")}</span>
                <span className="text-xs">{draft?.to ? format(draft.to, "yyyy-MM-dd") : "—"}</span>
              </div>
            </div>

            <Calendar
              className="p-3"
              defaultMonth={draft?.from}
              mode="range"
              numberOfMonths={2}
              onSelect={handleChange}
              selected={draft}
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
        "flex w-full items-center justify-between",
        isActive && "bg-primary text-primary-foreground hover:bg-primary/90",
      )}
      onClick={onClick}
      size="sm"
      variant="ghost"
    >
      {label}
      {isActive && <Check />}
    </AppButton>
  );
}
