import { Headset, Info, LayoutGrid, User } from "lucide-react";

import { MenuItems } from "@/widgets/AppSidebar/types";

export const menu: MenuItems = [
  { icon: LayoutGrid, title: "Дашборд", href: "/dashboard" },
  { icon: User, title: "Профиль", href: "/profile" },
  { icon: Info, title: "О нас", href: "/about" },
  { icon: Headset, title: "Поддержка", href: "/support" },
];
