import * as React from "react";

import { cn } from "@/shared/lib/cn";

const Textarea = React.forwardRef<HTMLTextAreaElement, React.ComponentProps<"textarea">>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        className={cn(
          "transition-standard border-input placeholder:text-muted-foreground focus-visible:ring-ring bg-background/80 dark:bg-input/30 hover:border-border-strong focus-visible:border-border-accent flex min-h-15 w-full rounded-xl border px-3 py-2 text-base leading-6 focus-visible:ring-2 focus-visible:outline-hidden disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          className
        )}
        {...props}
      />
    );
  }
);
Textarea.displayName = "Textarea";

export { Textarea };
