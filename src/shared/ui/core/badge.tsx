import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/shared/lib/cn";

const badgeVariants = cva(
  "transition-standard inline-flex w-fit shrink-0 items-center justify-center gap-1 overflow-hidden whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium tracking-[-0.02em] focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&>svg]:pointer-events-none [&>svg]:size-3",
  {
    defaultVariants: {
      variant: "default",
    },
    variants: {
      variant: {
        default:
          "border-border/60 bg-primary text-primary-foreground [a&]:hover:border-border-strong",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground [a&]:hover:opacity-95 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60",
        outline:
          "border-border bg-background/70 text-foreground [a&]:hover:border-border-strong [a&]:hover:bg-surface-hover [a&]:hover:text-foreground",
        secondary:
          "border-border/60 bg-secondary text-secondary-foreground [a&]:hover:border-border-strong [a&]:hover:bg-surface-hover",
      },
    },
  }
);

function Badge({
  asChild = false,
  className,
  variant,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "span";

  return (
    <Comp data-slot="badge" className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
