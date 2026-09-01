import type { ComponentProps } from "react";

import { cn } from "@/shared/lib/cn";

function Input({ className, type, ...props }: ComponentProps<"input">) {
  return (
    <input
      className={cn(
        "h-9 w-full min-w-0 rounded-xl border border-input bg-background/80 px-3 py-1 text-sm outline-hidden transition-standard selection:bg-primary selection:text-primary-foreground file:inline-flex file:h-7 file:border-0 file:bg-transparent file:font-medium file:text-foreground file:text-sm placeholder:text-muted-foreground hover:border-border-strong disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 sm:text-base md:text-sm dark:bg-input/30",
        "focus-visible:border-border-accent focus-visible:ring-2 focus-visible:ring-ring/50",
        "aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40",
        className,
      )}
      data-slot="input"
      type={type}
      {...props}
    />
  );
}

export { Input };
