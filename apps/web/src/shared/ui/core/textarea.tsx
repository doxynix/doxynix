import { type ComponentProps, forwardRef } from "react";

import { cn } from "@/shared/lib/cn";

const Textarea = forwardRef<HTMLTextAreaElement, ComponentProps<"textarea">>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          "flex min-h-15 w-full rounded-xl border border-input bg-background/80 px-3 py-2 text-base leading-6 transition-standard placeholder:text-muted-foreground hover:border-border-strong focus-visible:border-border-accent focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm dark:bg-input/30",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Textarea.displayName = "Textarea";

export { Textarea };
