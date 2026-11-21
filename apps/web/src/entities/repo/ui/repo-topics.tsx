import { AppBadge } from "@/shared/ui/core/badge";

type Props = {
  repoTopics?: null | string[];
  variant?: "default" | "outline" | "secondary";
};

export function RepoTopics({ repoTopics, variant }: Readonly<Props>) {
  if (repoTopics == null || repoTopics.length === 0) {
    return null;
  }

  return (
    <div className="mt-1 flex flex-wrap not-sm:justify-center gap-1">
      {repoTopics.slice(0, 10).map((topic) => (
        <AppBadge
          key={topic}
          variant={variant}
        >
          {topic}
        </AppBadge>
      ))}
      {repoTopics.length > 10 && (
        <span className="self-center text-2xs text-muted-foreground">
          +{repoTopics.length - 10}
        </span>
      )}
    </div>
  );
}
