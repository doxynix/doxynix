import { LayoutDashboard, User } from "lucide-react";

import { MenuItems } from "@/components/AppSidebar/types";

export const menu: MenuItems = [
  { icon: LayoutDashboard, title: "Дашборд", href: "/dashboard" },
  { icon: User, title: "Профиль", href: "/profile" },
];
