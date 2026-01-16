import { formatRelativeTime } from "@/shared/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import { CopyButton } from "@/shared/ui/CopyButton";

import { UiApiKey } from "@/entities/api-keys";
import { RevokeApiKeyDialog } from "./RevokeApiKeyDialog";
import { UpdateApiKeyDialog } from "./UpdateApiKeyDialog";

export function ApiKeyCard({ active }: { active: UiApiKey }) {
  return (
    <Card className="group justify-between">
      <CardHeader className="flex flex-row items-start justify-between pb-2">
        <div className="space-y-1 overflow-hidden">
          <CardTitle className="truncate text-base font-semibold">{active.name}</CardTitle>
          <CardDescription className="flex flex-col gap-2 text-xs">
            <p>Создан: {formatRelativeTime(active.createdAt)}</p>
            <p>Последнее использование: {formatRelativeTime(active.lastUsed)}</p>
            {active.description !== null && (
              <p className="text-muted-foreground line-clamp-4 leading-relaxed">
                {active.description}
              </p>
            )}
          </CardDescription>
        </div>
        <div className="flex shrink-0 flex-col items-center gap-1">
          <CopyButton value={active.id} className="h-9 w-9" />
          <UpdateApiKeyDialog apiKey={active} />
          <RevokeApiKeyDialog apiKey={active} />
        </div>
      </CardHeader>
      <CardContent>
        <div className="bg-muted text-muted-foreground truncate rounded-md p-2 font-mono text-xs">
          {active.prefix
            ? `${active.prefix}••••••••••••••••••••••••••••••••••••••••••••••••••••`
            : "dxnx_••••••••••••••••••••••••••••••••••••••••••••••••••••"}
        </div>
      </CardContent>
    </Card>
  );
}
