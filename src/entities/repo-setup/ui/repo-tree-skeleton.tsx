import { cn } from "@/shared/lib/cn";
import { Skeleton } from "@/shared/ui/core/skeleton";

type Props = {
  rows?: number;
  variant?: "setup" | "tree";
};

const LEVELS = [0, 1, 2, 2, 1, 2, 2, 2, 0, 1, 1, 2, 1, 0, 0, 1, 2, 1, 0, 1];
const WIDTHS = ["w-32", "w-48", "w-24", "w-40", "w-36", "w-20", "w-44", "w-28", "w-52", "w-32"];
const ICON_STYLE = "size-4 shrink-0 rounded-full";

export function RepoTreeSkeleton({ rows = 20, variant = "tree" }: Readonly<Props>) {
  const displayLevels = LEVELS.slice(0, rows);

  return (
    <div className="h-145 w-full space-y-2 p-1">
      {displayLevels.map((level, i) => (
        <div
          key={i}
          className="flex items-center gap-3 py-1"
          style={{ paddingLeft: `${level * 24}px` }}
        >
          <Skeleton className={ICON_STYLE} />

          <Skeleton className={ICON_STYLE} />

          {variant === "setup" && <Skeleton className={ICON_STYLE} />}

          <Skeleton className={cn("h-3.5 rounded-full", WIDTHS[i % WIDTHS.length])} />

          {variant === "setup" && i % 4 === 0 && (
            <Skeleton className="ml-auto h-3 w-8 rounded-full" />
          )}
        </div>
      ))}
    </div>
  );
}
