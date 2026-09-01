import type { ComponentProps } from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/shared/lib/cn";

const badgeVariants = cva(
  "inline-flex w-fit shrink-0 items-center justify-center gap-1 overflow-hidden whitespace-nowrap rounded-full border px-2 py-0.5 font-medium text-xs tracking-[-0.02em] transition-standard focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&>svg]:pointer-events-none [&>svg]:size-3",
  {
    defaultVariants: {
      variant: "default",
    },
    variants: {
      variant: {
        default: "border-border bg-primary text-primary-foreground [a&]:hover:border-border-strong",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground focus-visible:ring-destructive/20 dark:bg-destructive/60 dark:focus-visible:ring-destructive/40 [a&]:hover:opacity-95",
        outline:
          "border-border bg-background text-foreground [a&]:hover:border-border-strong [a&]:hover:bg-surface-hover [a&]:hover:text-foreground",
        secondary:
          "border-border bg-secondary text-secondary-foreground [a&]:hover:border-border-strong [a&]:hover:bg-surface-hover",
      },
    },
  },
);

function AppBadge({
  asChild = false,
  className,
  variant,
  ...props
}: ComponentProps<"span"> & VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "span";

  return (
    <Comp className={cn(badgeVariants({ variant }), className)} data-slot="badge" {...props} />
  );
}

export { AppBadge, badgeVariants };
