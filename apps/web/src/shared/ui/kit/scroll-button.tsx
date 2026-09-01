"use client";

import { MoveRight } from "lucide-react";

import { smoothScrollTo } from "@/shared/lib/scroll";

import { AppButton } from "../core/button";

type Props = {
  ariaLabel?: string;
  arrowClassName?: string;
  buttonClassName?: string;
  duration?: number;
  offset?: number;
  targetId: string;
};

export function ScrollButton({
  ariaLabel = "Scroll to next section",
  arrowClassName,
  buttonClassName,
  duration = 800,
  offset = 80,
  targetId,
}: Readonly<Props>) {
  return (
    <AppButton
      aria-label={ariaLabel}
      className={buttonClassName}
      onClick={() => {
        smoothScrollTo(targetId, offset, duration);
      }}
      variant="ghost"
    >
      <MoveRight className={arrowClassName} size={12} />
    </AppButton>
  );
}
