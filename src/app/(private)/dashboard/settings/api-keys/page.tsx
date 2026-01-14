import { Suspense } from "react";
import { Metadata } from "next";

import { ApiKeyCardSkeleton, ApiKeysListContainer, CreateApiKeyDialog } from "@/features/api-keys";

export const metadata: Metadata = {
  title: "API-ключи",
};

export default function ProfilePage() {
  return (
    <div className="flex w-full flex-col gap-6">
      <div className="flex justify-between">
        <div className="flex flex-col gap-2">
          <h2 className="text-2xl font-bold tracking-tight">API-ключи</h2>
          <p className="text-muted-foreground text-sm">Управляйте своими API-ключами</p>
        </div>
      </div>
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">Активные ключи</h3>
        <CreateApiKeyDialog />
      </div>
      <Suspense fallback={<ApiKeyCardSkeleton />}>
        <ApiKeysListContainer />
      </Suspense>
    </div>
  );
}
