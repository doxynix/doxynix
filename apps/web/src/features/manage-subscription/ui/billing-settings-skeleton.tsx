import { Skeleton } from "@/shared/ui/core/skeleton";

export function BillingSettingsSkeleton() {
  return (
    <div className="flex w-full flex-col gap-6">
      <Skeleton className="h-40 w-full" />
      <Skeleton className="h-40 w-full" />
    </div>
  );
}
