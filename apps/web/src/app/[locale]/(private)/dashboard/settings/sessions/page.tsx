import type { Metadata } from "next";

import { SessionsList } from "@/features/sessions/ui/sessions-list";

export const metadata: Metadata = {
  description: "View and manage your active security sessions and logged-in devices.",
  title: "Active Sessions",
};

export default function SessionsSettingsPage() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="font-bold text-2xl tracking-tight">Active Sessions</h1>
        <p className="text-muted-foreground text-sm">
          Here is a list of devices that have logged into your account. Revoke any unfamiliar
          sessions.
        </p>
      </div>

      <SessionsList />
    </div>
  );
}
