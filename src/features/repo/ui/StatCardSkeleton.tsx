import { Card, CardContent } from "@/shared/ui/card";
import { Skeleton } from "@/shared/ui/skeleton";

export async function StatCardSkeleton() {
  return (
    <div className="xs:grid-cols-2 mb-8 grid grid-cols-1 gap-4 lg:grid-cols-5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Card key={i} className="bg-card">
          <CardContent className="xs:p-3.5">
            <div className="flex items-center gap-3">
              <Skeleton className="h-8 w-8 rounded-xl" />

              <div className="flex flex-col gap-1">
                <Skeleton className="h-8 w-16" />
                <Skeleton className="h-5 w-32" />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
