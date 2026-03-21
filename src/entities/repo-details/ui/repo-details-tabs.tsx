"use client";

import type { Route } from "next";

import type { RepoStatus } from "@/shared/api/trpc";
import { getRepoDetailsMenu } from "@/shared/constants/navigation";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/core/button";
import { Link, usePathname } from "@/i18n/routing";

type Props = { name: string; owner: string; status: RepoStatus };

export function RepoDetailsTabs({ name, owner, status }: Readonly<Props>) {
  const pathname = usePathname();

  const nav = getRepoDetailsMenu(owner, name);
  const filteredNav = nav.filter((item) => {
    if (status === "NEW") {
      return item.id === "overview" || item.id === "settings";
    }
    return true;
  });

  return (
    <div className="border-border no-scrollbar relative flex w-full items-center gap-2 overflow-x-auto border-b">
      {filteredNav.map((n) => {
        const isActive = pathname === n.href;

        return (
          <Button key={n.label} asChild variant="ghost">
            <Link
              href={n.href as Route}
              className={cn(
                "relative flex items-center gap-2 rounded-b-none p-2 text-sm transition-all outline-none",
                "rounded-t-xl",
                isActive
                  ? "after:bg-foreground font-bold after:absolute after:bottom-0 after:left-0 after:h-0.5 after:w-full"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <span className="relative z-10 flex items-center gap-2">
                <n.icon className="size-4" />
                {n.label}
              </span>
            </Link>
          </Button>
        );
      })}
    </div>
  );
}
