import type { Metadata } from "next";

import { ConnectionsListContainer } from "@/features/connections/ui/connections-list-container";

export const metadata: Metadata = {
  description: "Manage your connected accounts and GitHub installations.",
  title: "Connections",
};

export default function ConnectionsPage() {
  return (
    <div className="flex flex-col gap-4">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">Connections</h1>
        <p className="text-muted-foreground text-sm">
          Manage your authentication methods and GitHub data access.
        </p>
      </div>

      <ConnectionsListContainer />
    </div>
  );
}
