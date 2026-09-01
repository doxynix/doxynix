import type * as React from "react";
import { RiArrowLeftSLine, RiArrowRightSLine } from "@remixicon/react";
import { type DateRange, DayPicker, type Matcher } from "react-day-picker";

import { cx, focusRing } from "../../lib/utils";

export type CalendarProps = React.ComponentProps<typeof DayPicker> & {
  enableYearNavigation?: boolean;
};

function Calendar({ className, classNames, showOutsideDays = true, ...props }: CalendarProps) {
  return (
    <DayPicker
      className={cx("p-3", className)}
      classNames={{
        caption_label: "text-sm font-medium",
        cell: cx(
          "relative p-0 text-center text-sm focus-within:relative focus-within:z-20",
          "text-gray-900 dark:text-gray-50",
          props.mode === "range"
            ? "[&:has(>.day-range-end)]:rounded-r-md [&:has(>.day-range-start)]:rounded-l-md first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md"
            : "[&:has([aria-selected])]:rounded-md",
        ),
        day: cx(
          "size-9 rounded-sm text-sm focus:z-10",
          "text-gray-900 dark:text-gray-50",
          "hover:bg-gray-200 dark:hover:bg-gray-700",
          focusRing,
        ),
        day_disabled:
          "text-gray-300! dark:text-gray-700! line-through disabled:hover:bg-transparent",
        day_hidden: "invisible",
        day_outside: "text-gray-400 dark:text-gray-600",
        day_range_end: "rounded-l-none rounded-r!",
        day_range_middle: cx(
          "rounded-none!",
          "aria-selected:bg-gray-100! aria-selected:text-gray-900!",
          "dark:aria-selected:bg-gray-900! dark:aria-selected:text-gray-50!",
        ),
        day_range_start: "rounded-r-none rounded-l!",
        day_selected: cx(
          "rounded-sm",
          "aria-selected:bg-blue-500 aria-selected:text-white",
          "dark:aria-selected:bg-blue-500 dark:aria-selected:text-white",
        ),
        day_today: "font-semibold",
        head_cell:
          "w-9 font-medium text-sm sm:text-xs text-center text-gray-400 dark:text-gray-600 pb-2",
        head_row: "flex",
        month: "flex flex-col gap-4",
        month_caption: "flex justify-center pt-1 relative items-center w-full",
        months: "flex flex-col sm:flex-row gap-2",
        nav: "flex items-center gap-1",
        nav_button: "size-7 bg-transparent p-0 opacity-50 hover:opacity-100",
        nav_button_next: "absolute right-1",
        nav_button_previous: "absolute left-1",
        row: "flex w-full mt-2",
        table: "w-full border-collapse space-x-1",
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation }) =>
          orientation === "left" ? (
            <RiArrowLeftSLine className="size-4" />
          ) : (
            <RiArrowRightSLine className="size-4" />
          ),
      }}
      showOutsideDays={showOutsideDays}
      {...props}
    />
  );
}

Calendar.displayName = "Calendar";

export { Calendar, type DateRange, type Matcher };
