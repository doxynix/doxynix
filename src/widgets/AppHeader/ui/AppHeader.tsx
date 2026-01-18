"use client";

import type { Route } from "next";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { SlashIcon } from "lucide-react";
import { User } from "next-auth";

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
import { SidebarToggle } from "@/widgets/AppSidebar";

import { NotificationsNav } from "./NotificationsNav";
import { UserNav } from "./UserNav";

type Props = {
  user: User;
};

export function AppHeader({ user }: Props) {
  const { state } = useSidebar();
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);

  return (
    <header className="bg-background flex h-full items-center justify-between p-4">
      <div className="flex items-center gap-2">
        <AppTooltip content={cn(state === "expanded" ? "Скрыть" : "Раскрыть")}>
          <SidebarToggle />
        </AppTooltip>

        <Logo className="mt-1 w-20" />

        <Breadcrumb>
          <BreadcrumbList>
            {segments.map((segment, index) => {
              const href = `/${segments.slice(0, index + 1).join("/")}`;
              const isLast = index === segments.length - 1;

              const decodedSegment = decodeURIComponent(segment);

              const textClasses = "truncate lowercase";

              const widthClasses = isLast
                ? "max-w-[150px] md:max-w-[300px]"
                : "max-w-[80px] md:max-w-[120px]";

              return (
                <div key={href} className="flex items-center gap-1.5">
                  <BreadcrumbSeparator>
                    <SlashIcon className="rotate-340" />
                  </BreadcrumbSeparator>

                  <BreadcrumbItem>
                    {isLast ? (
                      <BreadcrumbPage className={cn(textClasses, widthClasses)}>
                        {decodedSegment}
                      </BreadcrumbPage>
                    ) : (
                      <BreadcrumbLink asChild>
                        <Link href={href as Route} className={cn(textClasses, widthClasses)}>
                          {decodedSegment}
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
        <UserNav user={user} />
      </div>
    </header>
  );
}
