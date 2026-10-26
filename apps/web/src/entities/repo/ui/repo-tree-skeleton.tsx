import { Skeleton } from "@/shared/ui/core/skeleton";
import { SkeletonText } from "@/shared/ui/kit/app-skeleton";

type Props = {
  rows?: number;
  variant?: "setup" | "tree";
};

const LEVELS = [0, 1, 2, 2, 1, 2, 2, 2, 0, 1, 1, 2, 1, 0, 0, 1, 2, 1, 0, 1];
const WIDTHS = ["w-32", "w-48", "w-24", "w-40", "w-36", "w-20", "w-44", "w-28", "w-52", "w-32"];

export function RepoTreeSkeleton({ rows = 20, variant = "setup" }: Readonly<Props>) {
  const displayLevels = LEVELS.slice(0, rows);

  return (
    <div className="flex h-full w-full flex-col overflow-hidden p-1">
      {displayLevels.map((level, index) => (
        <div
          className="flex h-8 items-center gap-2"
          key={index}
          style={{ paddingLeft: `${level * 16}px` }}
        >
          <Skeleton className="size-4 shrink-0 rounded-full" />

          {variant === "setup" && <Skeleton className="size-4 shrink-0 rounded-[4px]" />}

          <Skeleton className="size-4 shrink-0 rounded-full" />

          <SkeletonText
            className="min-w-0 flex-1"
            lines={1}
            widths={[WIDTHS[index % WIDTHS.length] ?? "w-32"]}
          />

          {variant === "setup" && index % 4 === 0 && (
            <SkeletonText
              className="ml-auto"
              lines={1}
              size="sm"
              widths={["w-16"]}
            />
          )}
        </div>
      ))}
    </div>
  );
}
