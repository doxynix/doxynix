import type { ComponentProps, ReactNode } from "react";

import { cn } from "@/shared/lib/cn";
import { useSpinDelay } from "@/shared/lib/hooks/use-spin-delay";

import { AppButton } from "../core/button";
import { Spinner } from "../core/spinner";

type Props = ComponentProps<typeof AppButton> & {
  children: ReactNode;
  isLoading: boolean;
  delay?: number;
  minDuration?: number;
};

export function LoadingButton({
  children,
  className,
  disabled,
  isLoading,
  delay = 150,
  minDuration = 300,
  ...props
}: Props) {
  const showSpinner = useSpinDelay(isLoading, { delay, minDuration });

  return (
    <AppButton
      {...props}
      className={cn("relative grid grid-cols-1 grid-rows-1 items-center justify-center", className)}
      disabled={isLoading || disabled}
    >
      {showSpinner && (
        <span className="col-start-1 row-start-1 flex items-center justify-center animate-in fade-in-0 duration-150">
          <Spinner />
        </span>
      )}

      <span
        className={cn(
          "col-start-1 row-start-1 flex items-center justify-center gap-1.5 whitespace-nowrap transition-opacity",
          showSpinner ? "opacity-0 select-none pointer-events-none" : "opacity-100",
        )}
      >
        {children}
      </span>
    </AppButton>
  );
}
