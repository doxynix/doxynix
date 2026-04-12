import { Skeleton } from "@/shared/ui/core/skeleton";

export function CodeSkeleton() {
  const widths = [60, 45, 75, 30, 55, 40, 20, 80, 35, 50];
  const indents = [0, 0, 4, 4, 8, 4, 0, 0, 4, 0];

  return (
    <div className="h-full w-full space-y-3 overflow-hidden p-4 font-mono text-[13px]">
      {Array.from({ length: 32 }).map((_, i) => {
        const width = widths[i % widths.length]!;
        const indent = indents[i % indents.length]!;

        return (
          <div key={i} className="flex items-center gap-4">
            <div className="flex flex-1" style={{ paddingLeft: `${indent * 4}px` }}>
              <Skeleton
                className="h-3 rounded-sm"
                style={{
                  width: `${width}%`,
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
