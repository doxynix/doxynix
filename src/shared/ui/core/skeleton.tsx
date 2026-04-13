import { cn } from "@/shared/lib/cn";

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("bg-skeleton animate-skeleton-pulse rounded-xl", className)}
      {...props}
    />
  );
}

export { Skeleton };
