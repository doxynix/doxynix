"use client";

import { useState } from "react";

type Props = {
  isYear?: boolean;
  value?: Date | string;
};

export function DateComp({ isYear = false, value }: Readonly<Props>) {
  const [now] = useState(() => new Date());
  const targetDate = value ? new Date(value) : now;

  return (
    <span suppressHydrationWarning>
      {isYear ? targetDate.getFullYear() : targetDate.toLocaleDateString("en-US")}
    </span>
  );
}
