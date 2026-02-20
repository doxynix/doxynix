import { Badge } from "@/shared/ui/core/badge";

type Props = { repoTopics: string[] };

export function RepoTopics({ repoTopics }: Props) {
  return (
    <>
      {repoTopics != null && repoTopics.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-1 not-sm:justify-center">
          {repoTopics.slice(0, 10).map((topic) => (
            <Badge key={topic}>{topic}</Badge>
          ))}
          {repoTopics.length > 10 && (
            <span className="text-muted-foreground self-center text-[10px]">
              +{repoTopics.length - 10}
            </span>
          )}
        </div>
      )}
    </>
  );
}
