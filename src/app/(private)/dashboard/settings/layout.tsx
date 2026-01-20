import { ReactNode } from "react";

import { SettingsMenu } from "@/features/settings";

export default function SettingsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">Settings</h1>
      <div className="flex gap-12">
        <div className="flex flex-col gap-4">
          <SettingsMenu />
        </div>
        <div className="w-full">{children}</div>
      </div>
    </div>
  );
}
