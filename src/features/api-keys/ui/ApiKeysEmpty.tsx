import { CircleOff } from "lucide-react";

import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/shared/ui/empty";

export function ApiKeysEmpty() {
  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <CircleOff />
        </EmptyMedia>
        <EmptyTitle>No active API keys</EmptyTitle>
        <EmptyDescription>Add your first API key</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}
