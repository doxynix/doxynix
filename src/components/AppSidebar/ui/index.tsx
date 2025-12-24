"use client";

import Image from "next/image";

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
} from "@/components/ui/sidebar";
import { ThemeToggle } from "@/shared/ui/ThemeToggle";
import { SidebarLink } from "@/components/AppSidebar/ui/SidebarLink";
import { Logo } from "@/shared/ui/Logo/ui";

import { cn } from "@/lib/utils";
import { menu } from "@/components/AppSidebar/entities";

export function AppSidebar() {
  const { state } = useSidebar();

  return (
    <Sidebar collapsible="icon" variant="sidebar">
      <SidebarContent className="overflow-hidden">
        <SidebarGroup className="flex flex-col items-center justify-center">
          <SidebarHeader className="w-full flex items-center justify-center">
            <div className={cn("overflow-hidden h-8", state === "expanded" ? "w-full" : "w-6")}>
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
        <div className="flex items-center gap-4">
          <Image
            className={cn("rounded-full", state === "collapsed" && "order-0")}
            width={32}
            height={32}
            src="https://sun1-26.userapi.com/s/v1/ig2/s6o9ulfsYBU0tKW5hrlPyb8gvf7FUwQjIVKRJQ19FPJuPFC78S0ejWOpqmAeg-0ZxfcfZDvoy3-7BQGNovgFemHF.jpg?quality=95&as=32x32,48x48,72x72,108x108,160x160,240x240,360x360,480x479,540x539,640x639,720x719,800x799&from=bu&cs=800x0"
            alt="Фото профиля"
          />
          <p className={cn("duration-100", state === "collapsed" ? "opacity-0" : "opacity-100")}>
            Логин
          </p>
        </div>
        <ThemeToggle className="max-w-8 max-h-8" />
      </SidebarFooter>
    </Sidebar>
  );
}
