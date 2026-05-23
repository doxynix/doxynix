"use client";

import { useEffect, useRef, type ComponentProps } from "react";
import { ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { DayPicker, getDefaultClassNames, type DayButton } from "react-day-picker";

import { cn } from "@/shared/lib/cn";
import { AppButton, buttonVariants } from "@/shared/ui/core/button";

function Calendar({
  buttonVariant = "ghost",
  captionLayout = "label",
  className,
  classNames,
  components,
  formatters,
  showOutsideDays = true,
  ...props
}: ComponentProps<typeof DayPicker> & {
  buttonVariant?: ComponentProps<typeof AppButton>["variant"];
}) {
  const defaultClassNames = getDefaultClassNames();

  return (
    <DayPicker
      captionLayout={captionLayout}
      classNames={{
        button_next: cn(
          buttonVariants({ variant: buttonVariant }),
          "h-7 w-7 select-none p-0 aria-disabled:opacity-50",
          defaultClassNames.button_next
        ),
        button_previous: cn(
          buttonVariants({ variant: buttonVariant }),
          "h-7 w-7 select-none p-0 aria-disabled:opacity-50",
          defaultClassNames.button_previous
        ),
        caption_label: cn(
          "select-none font-medium",
          captionLayout === "label"
            ? "text-sm"
            : "[&>svg]:text-muted-foreground flex h-8 items-center gap-1 rounded-md pl-2 pr-1 text-sm [&>svg]:size-3.5",
          defaultClassNames.caption_label
        ),
        day: cn(
          "group/day relative aspect-square h-full w-full select-none p-0 text-center [&:first-child[data-selected=true]_button]:rounded-l-md [&:last-child[data-selected=true]_button]:rounded-r-md",
          defaultClassNames.day
        ),
        disabled: cn("text-muted-foreground opacity-50", defaultClassNames.disabled),
        dropdown: cn("bg-popover absolute inset-0 opacity-0", defaultClassNames.dropdown),
        dropdown_root: cn(
          "has-focus:border-ring border-input shadow-xs has-focus:ring-ring/50 has-focus:ring-[3px] relative rounded-md border",
          defaultClassNames.dropdown_root
        ),
        dropdowns: cn(
          "flex h-7 w-full items-center justify-center gap-1.5 text-sm font-medium",
          defaultClassNames.dropdowns
        ),
        hidden: cn("invisible", defaultClassNames.hidden),
        month: cn("flex w-full flex-col gap-4", defaultClassNames.month),
        month_caption: cn(
          "flex h-7 w-full items-center justify-center px-7",
          defaultClassNames.month_caption
        ),
        months: cn("relative flex flex-col gap-4 md:flex-row", defaultClassNames.months),
        nav: cn(
          "absolute inset-x-0 top-0 flex w-full items-center justify-between gap-1",
          defaultClassNames.nav
        ),
        outside: cn(
          "text-muted-foreground aria-selected:text-muted-foreground",
          defaultClassNames.outside
        ),
        range_end: cn("bg-accent rounded-r-md", defaultClassNames.range_end),
        range_middle: cn("rounded-none", defaultClassNames.range_middle),
        range_start: cn("bg-accent rounded-l-md", defaultClassNames.range_start),
        root: cn("w-fit", defaultClassNames.root),
        table: "w-full border-collapse",
        today: cn(
          "bg-accent text-accent-foreground rounded-md data-[selected=true]:rounded-none",
          defaultClassNames.today
        ),
        week: cn("mt-2 flex w-full", defaultClassNames.week),
        week_number: cn(
          "text-muted-foreground select-none text-[0.8rem]",
          defaultClassNames.week_number
        ),
        week_number_header: cn("w-7 select-none", defaultClassNames.week_number_header),
        weekday: cn(
          "text-muted-foreground flex-1 select-none rounded-md text-[0.8rem] font-normal",
          defaultClassNames.weekday
        ),
        weekdays: cn("flex", defaultClassNames.weekdays),
        ...classNames,
      }}
      components={{
        Chevron: ({ className, orientation, ...props }) => {
          if (orientation === "left") {
            return <ChevronLeftIcon className={cn("size-4", className)} {...props} />;
          }

          if (orientation === "right") {
            return <ChevronRightIcon className={cn("size-4", className)} {...props} />;
          }

          return <ChevronDownIcon className={cn("size-4", className)} {...props} />;
        },
        DayButton: CalendarDayButton,
        Root: ({ className, rootRef, ...props }) => {
          return <div ref={rootRef} data-slot="calendar" className={cn(className)} {...props} />;
        },
        WeekNumber: ({ children, ...props }) => {
          return (
            <td {...props}>
              <div className="flex size-7 items-center justify-center text-center">{children}</div>
            </td>
          );
        },
        ...components,
      }}
      formatters={{
        formatMonthDropdown: (date) => date.toLocaleString("default", { month: "short" }),
        ...formatters,
      }}
      showOutsideDays={showOutsideDays}
      className={cn(
        "bg-popover group/calendar p-3 [--cell-size:2rem] in-data-[slot=card-content]:bg-transparent in-data-[slot=popover-content]:bg-transparent",
        String.raw`rtl:**:[.rdp-button\_next>svg]:rotate-180`,
        String.raw`rtl:**:[.rdp-button\_previous>svg]:rotate-180`,
        className
      )}
      {...props}
    />
  );
}

function CalendarDayButton({
  className,
  day,
  modifiers,
  ...props
}: ComponentProps<typeof DayButton>) {
  const defaultClassNames = getDefaultClassNames();

  const ref = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (modifiers.focused) ref.current?.focus();
  }, [modifiers.focused]);

  return (
    <AppButton
      ref={ref}
      size="icon"
      variant="ghost"
      data-day={day.date.toLocaleDateString()}
      data-range-end={modifiers.range_end}
      data-range-middle={modifiers.range_middle}
      data-range-start={modifiers.range_start}
      data-selected-single={
        modifiers.selected &&
        !modifiers.range_start &&
        !modifiers.range_end &&
        !modifiers.range_middle
      }
      className={cn(
        "data-[selected-single=true]:bg-primary data-[selected-single=true]:text-primary-foreground data-[range-middle=true]:bg-accent data-[range-middle=true]:text-accent-foreground data-[range-start=true]:bg-primary data-[range-start=true]:text-primary-foreground data-[range-end=true]:bg-primary data-[range-end=true]:text-primary-foreground group-data-[focused=true]/day:border-ring group-data-[focused=true]/day:ring-ring/50 flex aspect-square h-auto w-full min-w-7 flex-col gap-1 leading-none font-normal group-data-[focused=true]/day:relative group-data-[focused=true]/day:z-10 group-data-[focused=true]/day:ring-[3px] data-[range-end=true]:rounded-md data-[range-middle=true]:rounded-none data-[range-start=true]:rounded-md [&>span]:text-xs [&>span]:opacity-70",
        defaultClassNames.day,
        className
      )}
      {...props}
    />
  );
}

export { Calendar, CalendarDayButton };
