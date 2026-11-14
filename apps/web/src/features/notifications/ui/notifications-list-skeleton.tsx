import { SkeletonList } from "@/shared/ui/kit/app-skeleton";

import { NotificationCardSkeleton } from "@/entities/notification/ui/notification-card-skeleton";

type Props = { count: number };

export function NotificationsListSkeleton({ count }: Readonly<Props>) {
  return (
    <SkeletonList
      className="flex flex-col gap-3"
      count={count}
      renderItem={() => <NotificationCardSkeleton />}
    />
  );
}
