import { Metadata } from "next";

import { DeleteAccountCard, DeleteAllReposCard } from "@/features/danger-zone";

export const metadata: Metadata = {
  title: "Danger Zone",
};

export default function DangerZonePage() {
  return (
    <div className="flex w-full flex-col gap-6">
      <div className="flex justify-between">
        <div className="flex flex-col gap-2">
          <h2 className="text-destructive text-2xl font-bold tracking-tight">Danger Zone</h2>
          <p className="text-muted-foreground text-sm">Irreversible and destructive actions</p>
        </div>
      </div>
      <DeleteAllReposCard />
      <DeleteAccountCard />
    </div>
  );
}
