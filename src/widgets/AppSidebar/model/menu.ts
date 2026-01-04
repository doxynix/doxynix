import { FolderGit2, Headset, LayoutGrid, Settings } from "lucide-react";

import { MenuItems } from "@/shared/types/menuItem";

export const menu: MenuItems = [
  { icon: LayoutGrid, title: "Обзор", href: "/dashboard" },
  { icon: FolderGit2, title: "Репозитории", href: "/repo" },
  { icon: Settings, title: "Настройки", href: "/settings" },
  { icon: Headset, title: "Помощь", href: "/support" },
];
