"use client";

import { useCallback, useEffect, useState } from "react";

import { formatRelativeTime } from "@/shared/lib/utils";

type Props = {
  date: Date | string;
  locale: string;
};

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export function TimeAgo({ date, locale }: Props) {
  const [relativeTime, setRelativeTime] = useState(() => formatRelativeTime(date, locale));

  const updateTime = useCallback(() => {
    const now = new Date().getTime();
    const created = new Date(date).getTime();
    const diff = now - created;

    setRelativeTime(formatRelativeTime(date, locale));

    let nextDelay: number | null = null;

    if (diff < HOUR) {
      nextDelay = MINUTE;
    } else if (diff < DAY) {
      nextDelay = HOUR;
    } else {
      nextDelay = null;
    }

    return nextDelay;
  }, [date, locale]);

  useEffect(() => {
    let timerId: NodeJS.Timeout;

    const tick = () => {
      const delay = updateTime();
      if (delay != null) {
        timerId = setTimeout(tick, delay);
      }
    };

    tick();

    return () => {
      if (timerId) clearTimeout(timerId);
    };
  }, [updateTime]);

  return (
    <span className="text-muted-foreground mt-1 text-xs" suppressHydrationWarning>
      {relativeTime}
    </span>
  );
}
