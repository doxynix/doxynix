import type { Route } from "next";
import Link from "next/link";

import { publicHeaderMenu } from "@/shared/constants/navigation";
import { Button } from "@/shared/ui/button";
import { Logo } from "@/shared/ui/Logo";
import { ThemeToggle } from "@/shared/ui/ThemeToggle";

export function PublicHeader() {
  return (
    <header className="bg-background flex h-full flex-wrap items-center justify-between p-4">
      <div className="flex items-center gap-2">
        <Logo className="w-20" />
      </div>
      <nav className="flex gap-4">
        {publicHeaderMenu.map((item) => (
          <Button key={item.href} variant="ghost" asChild>
            <Link href={item.href as Route} className="flex items-center gap-2">
              {item.icon && <item.icon />}
              {item.label}
            </Link>
          </Button>
        ))}
      </nav>
      <div className="flex items-center gap-4">
        <Button variant="outline" asChild>
          <Link href="/auth">Начать</Link>
        </Button>
        <ThemeToggle className="text-muted-foreground" />
      </div>
    </header>
  );
}
