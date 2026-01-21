import { ReactNode } from "react";

import { cn } from "@/shared/lib/utils";

import { Button } from "../core/button";
import { Spinner } from "../core/spinner";

type Props = {
  isLoading: boolean;
  children: ReactNode;
  loadingText?: string;
} & React.ComponentProps<typeof Button>;

export function LoadingButton({
  isLoading,
  children,
  loadingText = "Loading......",
  disabled,
  className,
  ...props
}: Props) {
  return (
    <Button {...props} disabled={isLoading || disabled} className={cn("relative", className)}>
      <span className="px-3 opacity-0">{loadingText}</span>

      <span className="absolute inset-0 flex items-center justify-center gap-2 p-2">
        {isLoading ? (
          <>
            <Spinner className="h-4 w-4" />
            {loadingText}
          </>
        ) : (
          children
        )}
      </span>
    </Button>
  );
}
