"use client";

import { MoveRight } from "lucide-react";

import { smoothScrollTo } from "@/shared/lib/utils";

import { Button } from "../core/button";

type Props = {
  targetId: string;
  offset?: number;
  duration?: number;
  buttonClassName?: string;
  arrowClassName?: string;
};

export function ScrollButton({
  targetId,
  offset = 80,
  duration = 800,
  buttonClassName,
  arrowClassName,
}: Props) {
  return (
    <Button
      onClick={() => {
        smoothScrollTo(targetId, offset, duration);
      }}
      className={buttonClassName}
      variant="ghost"
    >
      <MoveRight size={12} className={arrowClassName} />
    </Button>
  );
}
