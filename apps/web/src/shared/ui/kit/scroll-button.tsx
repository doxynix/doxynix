"use client";

import { MoveRight } from "lucide-react";
import { useTranslations } from "next-intl";

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
  ariaLabel,
  arrowClassName,
  buttonClassName,
  duration = 800,
  offset = 80,
  targetId,
}: Readonly<Props>) {
  const t = useTranslations("Common");
  return (
    <AppButton
      aria-label={ariaLabel ?? t("scroll_to_next_section")}
      className={buttonClassName}
      onClick={() => {
        smoothScrollTo(targetId, offset, duration);
      }}
      variant="ghost"
    >
      <MoveRight
        className={arrowClassName}
        size={12}
      />
    </AppButton>
  );
}
