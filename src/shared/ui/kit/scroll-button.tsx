"use client";

import { MoveRight } from "lucide-react";

import { smoothScrollTo } from "@/shared/lib/utils";

import { Button } from "../core/button";

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
    <Button
      variant="ghost"
      aria-label={ariaLabel}
      onClick={() => {
        smoothScrollTo(targetId, offset, duration);
      }}
      className={buttonClassName}
    >
      <MoveRight size={12} className={arrowClassName} />
    </Button>
  );
}
