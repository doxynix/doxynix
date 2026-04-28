"use client";

import type { Route } from "next";
import { useSearchParams } from "next/navigation";

import { getRepoDetailsMenu } from "@/shared/constants/navigation";
import { cn } from "@/shared/lib/cn";
import { isRouteActive } from "@/shared/lib/navigation-utils";
import { Button } from "@/shared/ui/core/button";
import { Link, usePathname } from "@/i18n/routing";

import { buildRepoDetailHref } from "../model/repo-workspace-navigation";

type Props = { name: string; owner: string };

export function RepoDetailsTabs({ name, owner }: Readonly<Props>) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const nav = getRepoDetailsMenu(owner, name);

  return (
    <div className="no-scrollbar relative flex h-12 w-full items-center gap-1 overflow-x-auto">
      {nav.map((n) => {
        const baseHref = n.href ?? "/dashboard";
        const isActive = isRouteActive(pathname, baseHref, Boolean(n.exact));
        const href = buildRepoDetailHref(baseHref, searchParams) as Route;

        return (
          <Button key={n.id} asChild variant="ghost" className={cn("relative h-8")}>
            <Link
              href={href}
              className={cn(
                "flex items-center gap-2 text-sm outline-hidden",
                isActive
                  ? "after:bg-foreground after:absolute after:-bottom-2 after:left-0 after:h-0.5 after:w-full"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <n.icon />
              <span>{n.label}</span>
            </Link>
          </Button>
        );
      })}
    </div>
  );
}
