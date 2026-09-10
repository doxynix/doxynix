"use client";

import type { ComponentProps } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DayPicker } from "react-day-picker";

import { cn } from "@/shared/lib/cn";

export type CalendarProps = ComponentProps<typeof DayPicker> & {
  enableYearNavigation?: boolean;
};

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  enableYearNavigation: _enableYearNavigation,
  ...props
}: CalendarProps) {
  return (
    <DayPicker
      className={cn("p-3", className)}
      classNames={{
        button_next:
          "absolute right-1 size-7 bg-transparent p-0 opacity-50 hover:opacity-100 inline-flex items-center justify-center rounded-md border border-input text-sm hover:bg-accent hover:text-accent-foreground",
        button_previous:
          "absolute left-1 size-7 bg-transparent p-0 opacity-50 hover:opacity-100 inline-flex items-center justify-center rounded-md border border-input text-sm hover:bg-accent hover:text-accent-foreground",
        caption_label: "text-sm font-medium",
        day: "size-9 p-0 text-center text-sm relative flex items-center justify-center",
        day_button: cn(
          "size-9 p-0 font-normal rounded-md inline-flex items-center justify-center transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-hidden",
          "aria-selected:opacity-100",
        ),
        disabled: "text-muted-foreground opacity-50 line-through",
        hidden: "invisible",
        month: "flex flex-col gap-4",
        month_caption: "flex justify-center pt-1 relative items-center w-full",
        month_grid: "w-full border-collapse space-y-1",
        months: "flex flex-col sm:flex-row gap-2",
        nav: "flex items-center gap-1",
        outside: "text-muted-foreground opacity-50",
        range_end: "rounded-r-md bg-accent text-accent-foreground",
        range_middle: "aria-selected:bg-accent aria-selected:text-accent-foreground rounded-none",
        range_start: "rounded-l-md bg-accent text-accent-foreground",
        selected:
          "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground rounded-md",
        today: "bg-accent text-accent-foreground font-semibold",
        week: "flex w-full mt-2",
        weekday: "text-muted-foreground rounded-md w-9 font-normal text-[0.8rem] text-center",
        weekdays: "flex",
        weeks: "w-full space-y-1",
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation }) =>
          orientation === "left" ? (
            <ChevronLeft className="size-4" />
          ) : (
            <ChevronRight className="size-4" />
          ),
      }}
      showOutsideDays={showOutsideDays}
      {...props}
    />
  );
}

Calendar.displayName = "Calendar";

export { Calendar };
