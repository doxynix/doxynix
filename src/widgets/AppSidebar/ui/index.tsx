"use client";

import Image from "next/image";
import { CircleUserRound } from "lucide-react";
import { useSession } from "next-auth/react";

import { cn } from "@/shared/lib/utils";
import { Logo } from "@/shared/ui/Logo/ui";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarSeparator,
  useSidebar,
} from "@/shared/ui/sidebar";
import { ThemeToggle } from "@/shared/ui/ThemeToggle";
import { menu } from "@/widgets/AppSidebar/menu";
import { SidebarLink } from "@/widgets/AppSidebar/ui/SidebarLink";

export function AppSidebar() {
  const { state } = useSidebar();

  const { data: session } = useSession();
  const user = session?.user;
  const name = user?.name ?? "user";
  const avatar = user?.image;

  return (
    <Sidebar collapsible="icon" variant="sidebar">
      <SidebarContent className="overflow-hidden">
        <SidebarGroup className="flex flex-col items-center justify-center">
          <SidebarHeader className="flex w-full items-center justify-center">
            <div className={cn("h-8 overflow-hidden", state === "expanded" ? "w-full" : "w-6")}>
              <Logo collapsed={state === "collapsed"} />
            </div>
          </SidebarHeader>
          <SidebarGroupContent>
            <SidebarMenu>
              {menu.map((item) => (
                <SidebarLink key={item.href} href={item.href} icon={item.icon} title={item.title} />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="flex flex-row flex-wrap items-end justify-between gap-4">
        <SidebarSeparator className="m-0" />
        <div className="flex items-center justify-center gap-4">
          {avatar !== null ? (
            <Image
              src={avatar ?? "/avatar-placeholder.png"}
              alt={name || "User"}
              width={36}
              height={36}
              className={cn("rounded-full object-cover", state === "collapsed" && "order-0")}
            />
          ) : (
            <CircleUserRound size={36} />
          )}
          <p
            className={cn(
              "truncate duration-100",
              state === "collapsed" ? "opacity-0" : "opacity-100"
            )}
          >
            {user?.name}
          </p>
        </div>
        <ThemeToggle className="max-h-8 max-w-8" />
      </SidebarFooter>
    </Sidebar>
  );
}
