import { SkeletonList, SkeletonText } from "@/shared/ui/kit/app-skeleton";

const LINE_WIDTHS = [
  "w-[60%]",
  "w-[45%]",
  "w-[75%]",
  "w-[30%]",
  "w-[55%]",
  "w-[40%]",
  "w-[20%]",
  "w-[80%]",
  "w-[35%]",
  "w-[50%]",
];

const LINE_INDENTS = [
  "ml-0",
  "ml-0",
  "ml-4",
  "ml-4",
  "ml-8",
  "ml-4",
  "ml-0",
  "ml-0",
  "ml-4",
  "ml-0",
];

const LINES = 32;

export function CodeSkeleton() {
  return (
    <div className="flex h-full w-full overflow-hidden font-mono text-[13px]">
      <SkeletonList
        className="flex w-10 shrink-0 flex-col gap-0.5 border-r py-1"
        count={LINES}
        itemClassName="self-end"
        renderItem={() => (
          <SkeletonText
            lines={1}
            size="sm"
            widths={["w-4"]}
          />
        )}
      />

      <SkeletonList
        className="flex flex-1 flex-col gap-0.5 overflow-hidden p-1"
        count={LINES}
        itemClassName="flex items-center"
        renderItem={(index) => (
          <SkeletonText
            className={`min-w-0 flex-1 ${LINE_INDENTS[index % LINE_INDENTS.length]}`}
            lines={1}
            size="sm"
            widths={[LINE_WIDTHS[index % LINE_WIDTHS.length] ?? "w-1/2"]}
          />
        )}
      />

      <div className="w-20 shrink-0 border-l" />
    </div>
  );
}
