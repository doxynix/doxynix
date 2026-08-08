"use client";

import { useEffect, useState } from "react";

import { cn } from "@/shared/lib/cn";
import { formatFullDate, formatRelativeTime } from "@/shared/lib/date-utils";

import { AppTooltip } from "./app-tooltip";

type Props = {
  className?: string;
  date: Date | string;
  locale: string;
  tooltipLabel?: string;
  withTooltip?: boolean;
};

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export function TimeAgo({
  className,
  date,
  locale,
  tooltipLabel,
  withTooltip = true,
}: Readonly<Props>) {
  const [relativeTime, setRelativeTime] = useState(() => formatRelativeTime(date, locale));

  const fullDate = () => {
    const formatted = formatFullDate(date, locale);
    return tooltipLabel ? `${tooltipLabel} ${formatted}` : formatted;
  };

  useEffect(() => {
    let timerId: NodeJS.Timeout;

    const tick = () => {
      const now = Date.now();
      const created = new Date(date).getTime();
      const diff = now - created;

      setRelativeTime(formatRelativeTime(date, locale));

      let nextDelay: null | number = null;

      if (diff < HOUR) {
        nextDelay = MINUTE;
      } else if (diff < DAY) {
        nextDelay = HOUR;
      }

      if (nextDelay != null) {
        timerId = setTimeout(tick, nextDelay);
      }
    };

    tick();

    return () => {
      clearTimeout(timerId);
    };
  }, [date, locale]);

  const content = (
    <span
      suppressHydrationWarning
      className={cn("text-muted-foreground hover:text-foreground transition-colors", className)}
    >
      {relativeTime}
    </span>
  );

  if (!withTooltip) return content;

  return <AppTooltip content={fullDate()}>{content}</AppTooltip>;
}
