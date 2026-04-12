"use client";

import { useEffect, useState } from "react";

import { formatRelativeTime } from "@/shared/lib/utils";

type Props = {
  date: Date | string;
  locale: string;
};

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export function TimeAgo({ date, locale }: Readonly<Props>) {
  const [relativeTime, setRelativeTime] = useState(() => formatRelativeTime(date, locale));

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

  return (
    <span suppressHydrationWarning className="text-muted-foreground mt-1 text-xs">
      {relativeTime}
    </span>
  );
}
