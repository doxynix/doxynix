import { Card, CardContent, CardHeader } from "@/shared/ui/card";
import { Skeleton } from "@/shared/ui/skeleton";

type Props = {
  count?: number;
};

export function ApiKeyCardSkeleton({ count }: Props) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {Array.from({ length: count ?? 4 }).map((_, i) => (
        <Card key={i}>
          <CardHeader className="flex flex-row items-start justify-between pb-2">
            <div className="w-full max-w-[70%] space-y-1">
              <Skeleton className="h-6 w-32" />

              <div className="flex flex-col gap-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-28" />
              </div>
            </div>

            <Skeleton className="h-9 w-9 rounded-md" />
          </CardHeader>

          <CardContent>
            <Skeleton className="mb-2 h-5 w-3/4" />
            <Skeleton className="h-8 w-full rounded-md" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
