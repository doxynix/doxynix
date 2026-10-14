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
      aria-busy={showSpinner}
      className={cn("relative", className)}
      disabled={isLoading || disabled}
    >
      {showSpinner && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 flex animate-in items-center justify-center fade-in-0 duration-150"
        >
          <Spinner />
        </span>
      )}

      <span
        className={cn(
          "transition-opacity",
          showSpinner && "pointer-events-none opacity-0 select-none",
        )}
      >
        {children}
      </span>
    </AppButton>
  );
}
