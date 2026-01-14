import { CircleOff } from "lucide-react";

import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/shared/ui/empty";

export function ApiKeysEmpty() {
  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <CircleOff />
        </EmptyMedia>
        <EmptyTitle>Нет активных API-ключей</EmptyTitle>
        <EmptyDescription>Добавьте свой первый API-ключ</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}
