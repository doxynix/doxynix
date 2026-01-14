import { Metadata } from "next";

import { DeleteAccountCard, DeleteAllReposCard } from "@/features/danger-zone";

export const metadata: Metadata = {
  title: "Опасная зона",
};

export default function DangerZonePage() {
  return (
    <div className="flex w-full flex-col gap-6">
      <div className="flex justify-between">
        <div className="flex flex-col gap-2">
          <h2 className="text-destructive text-2xl font-bold tracking-tight">Опасная зона</h2>
          <p className="text-muted-foreground text-sm">Необратимые и разрушительные действия</p>
        </div>
      </div>
      <DeleteAllReposCard />
      <DeleteAccountCard />
    </div>
  );
}
