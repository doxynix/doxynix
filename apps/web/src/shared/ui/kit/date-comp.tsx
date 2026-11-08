"use client";

import { useState } from "react";
import { useLocale } from "next-intl";

type Props = {
  isYear?: boolean;
  value?: Date | string;
};

export function DateComp({ isYear = false, value }: Readonly<Props>) {
  const locale = useLocale();
  const [now] = useState(() => new Date());
  const targetDate = value ? new Date(value) : now;

  return (
    <span suppressHydrationWarning>
      {isYear ? targetDate.getFullYear() : targetDate.toLocaleDateString(locale)}
    </span>
  );
}
