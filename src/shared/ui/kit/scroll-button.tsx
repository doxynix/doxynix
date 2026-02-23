"use client";

import { MoveRight } from "lucide-react";

import { smoothScrollTo } from "@/shared/lib/utils";

import { Button } from "../core/button";

type Props = {
  arrowClassName?: string;
  buttonClassName?: string;
  duration?: number;
  offset?: number;
  targetId: string;
};

export function ScrollButton({
  arrowClassName,
  buttonClassName,
  duration = 800,
  offset = 80,
  targetId,
}: Readonly<Props>) {
  return (
    <Button
      variant="ghost"
      onClick={() => {
        smoothScrollTo(targetId, offset, duration);
      }}
      className={buttonClassName}
    >
      <MoveRight size={12} className={arrowClassName} />
    </Button>
  );
}
