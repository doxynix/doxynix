import { Card } from "@/shared/ui/core/card";

import { NotificationCardSkeleton } from "@/entities/notification/ui/notification-card-skeleton";

type Props = { count: number };

export function NotificationsListSkeleton({ count }: Readonly<Props>) {
  return (
    <Card className="gap-0 divide-y divide-border overflow-hidden p-0">
      {Array.from({ length: count }, (_, index) => (
        <NotificationCardSkeleton key={index} />
      ))}
    </Card>
  );
}
