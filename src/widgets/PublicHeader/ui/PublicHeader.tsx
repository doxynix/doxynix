"use client";

import { Logo } from "@/shared/ui/Logo";
import { ThemeToggle } from "@/shared/ui/ThemeToggle";

export function PublicHeader() {
  return (
    <header className="flex h-full items-center justify-between p-4">
      <div className="flex items-center gap-2">
        <Logo className="w-20" />
      </div>

      <div className="flex items-center gap-4">
        <ThemeToggle className="text-muted-foreground" />
      </div>
    </header>
  );
}
