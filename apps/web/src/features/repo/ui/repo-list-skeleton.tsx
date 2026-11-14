import { SkeletonList, SkeletonText } from "@/shared/ui/kit/app-skeleton";

import { RepoCardSkeleton } from "@/entities/repo/ui/repo-card-skeleton";

type Props = {
  count: number;
  showTotalCount?: boolean;
};

export function RepoListSkeleton({ count, showTotalCount = true }: Readonly<Props>) {
  return (
    <>
      {showTotalCount && (
        <div className="mb-4">
          <SkeletonText
            lines={1}
            size="lg"
            widths={["w-24"]}
          />
        </div>
      )}
      <SkeletonList
        className="flex flex-col gap-3"
        count={count}
        renderItem={() => <RepoCardSkeleton />}
      />
    </>
  );
}
