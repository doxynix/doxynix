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
  useSidebar,
} from "@/components/ui/sidebar";
import { menu } from "@/components/AppSidebar/entities";
import { ThemeToggle } from "@/shared/ThemeToggle";
import { cn } from "@/lib/utils";
import { SidebarLink } from "@/components/AppSidebar/ui/SidebarLink";

export function AppSidebar() {
  const { state } = useSidebar();

  return (
    <Sidebar collapsible="icon" className="bg-bg-sidebar" variant="sidebar">
      <SidebarContent>
        <SidebarGroup className="flex flex-col items-center justify-center">
          <SidebarHeader className="truncate">Тут будет лого приложения</SidebarHeader>
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
        <Image
          className={cn("rounded-full", state === "collapsed" && "order-0")}
          width={32}
          height={32}
          src="https://sun1-26.userapi.com/s/v1/ig2/s6o9ulfsYBU0tKW5hrlPyb8gvf7FUwQjIVKRJQ19FPJuPFC78S0ejWOpqmAeg-0ZxfcfZDvoy3-7BQGNovgFemHF.jpg?quality=95&as=32x32,48x48,72x72,108x108,160x160,240x240,360x360,480x479,540x539,640x639,720x719,800x799&from=bu&cs=800x0"
          alt="Фото профиля"
        />
        <ThemeToggle className="max-w-8 max-h-8" />
      </SidebarFooter>
    </Sidebar>
  );
}
