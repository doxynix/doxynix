import type { ComponentProps } from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/shared/lib/cn";

const cardVariants = cva(
  "group flex flex-col rounded-2xl border border-border bg-card text-card-foreground transition-standard",
  {
    defaultVariants: {
      interactive: false,
      size: "default",
      tone: "default",
    },
    variants: {
      interactive: {
        false: "",
        true: "hover:bg-surface-hover/30",
      },
      size: {
        compact: "gap-4 rounded-xl px-4 py-4",
        default: "gap-6 py-6",
        row: "flex-row items-start gap-3 rounded-xl px-4 py-3.5",
      },
      tone: {
        danger: "border-destructive/30",
        default: "",
        selected: "bg-surface-selected",
      },
    },
  },
);

type CardProps = ComponentProps<"div"> &
  VariantProps<typeof cardVariants> & {
    asChild?: boolean;
  };

function Card({
  asChild = false,
  className,
  interactive,
  size,
  tone,
  ...props
}: Readonly<CardProps>) {
  const Comp = asChild ? Slot : "div";

  return (
    <Comp
      className={cn(cardVariants({ interactive, size, tone }), className)}
      data-size={size ?? "default"}
      data-slot="card"
      {...props}
    />
  );
}

function CardHeader({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "@container/card-header grid auto-rows-min grid-rows-[auto_auto] items-start gap-2 px-6 has-data-[slot=card-action]:grid-cols-[1fr_auto] [.border-b]:pb-6",
        className,
      )}
      data-slot="card-header"
      {...props}
    />
  );
}

function CardTitle({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "font-semibold text-base group-data-[size=compact]:text-sm group-data-[size=row]:text-sm",
        className,
      )}
      data-slot="card-title"
      {...props}
    />
  );
}

function CardDescription({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "text-muted-foreground text-sm group-data-[size=compact]:text-xs group-data-[size=row]:text-xs",
        className,
      )}
      data-slot="card-description"
      {...props}
    />
  );
}

function CardAction({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn("col-start-2 row-span-2 row-start-1 self-start justify-self-end", className)}
      data-slot="card-action"
      {...props}
    />
  );
}

function CardContent({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn("px-6", className)}
      data-slot="card-content"
      {...props}
    />
  );
}

function CardFooter({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn("flex items-center px-6 [.border-t]:pt-6", className)}
      data-slot="card-footer"
      {...props}
    />
  );
}

export {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  cardVariants,
};
