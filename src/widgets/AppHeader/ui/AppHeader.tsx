"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SlashIcon } from "lucide-react";

import { cn } from "@/shared/lib/utils";
import { AppTooltip } from "@/shared/ui/AppTooltip";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/shared/ui/breadcrumb";
import { Logo } from "@/shared/ui/Logo";
import { useSidebar } from "@/shared/ui/sidebar";
import { ThemeToggle } from "@/shared/ui/ThemeToggle";
import { AppCommandMenu } from "@/widgets/AppCommandMenu";
import { NotificationsNav, UserNav } from "@/widgets/AppHeader";
import { SidebarToggle } from "@/widgets/AppSidebar";

export function AppHeader() {
  const { state } = useSidebar();
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);

  return (
    <header className="flex h-full items-center justify-between p-4">
      <div className="flex items-center gap-2">
        <AppTooltip content={cn(state === "expanded" ? "Скрыть" : "Раскрыть")}>
          <SidebarToggle />
        </AppTooltip>

        <Logo className="w-20" />

        <Breadcrumb>
          <BreadcrumbList>
            {segments.map((segment, index) => {
              const href = `/${segments.slice(0, index + 1).join("/")}`;
              const isLast = index === segments.length - 1;

              return (
                <div key={href} className="flex items-center gap-1.5">
                  <BreadcrumbSeparator>
                    <SlashIcon className="rotate-340" />
                  </BreadcrumbSeparator>

                  <BreadcrumbItem>
                    {isLast ? (
                      <BreadcrumbPage className="capitalize">{segment}</BreadcrumbPage>
                    ) : (
                      <BreadcrumbLink asChild>
                        <Link href={href} className="capitalize">
                          {segment}
                        </Link>
                      </BreadcrumbLink>
                    )}
                  </BreadcrumbItem>
                </div>
              );
            })}
          </BreadcrumbList>
        </Breadcrumb>
      </div>

      <div className="flex items-center gap-4">
        <AppCommandMenu />

        <ThemeToggle className="text-muted-foreground" />
        <NotificationsNav />
        <UserNav />
      </div>
    </header>
  );
}
