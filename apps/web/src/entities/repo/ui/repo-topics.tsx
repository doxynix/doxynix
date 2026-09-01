import { AppBadge } from "@/shared/ui/core/badge";

type Props = { repoTopics?: null | string[] };

export function RepoTopics({ repoTopics }: Readonly<Props>) {
  if (repoTopics == null || repoTopics.length === 0) {
    return null;
  }

  return (
    <div className="mt-1 flex flex-wrap not-sm:justify-center gap-1">
      {repoTopics.slice(0, 10).map((topic) => (
        <AppBadge key={topic}>{topic}</AppBadge>
      ))}
      {repoTopics.length > 10 && (
        <span className="self-center text-[10px] text-muted-foreground">
          +{repoTopics.length - 10}
        </span>
      )}
    </div>
  );
}
