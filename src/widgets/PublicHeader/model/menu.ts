import { Headset, Home, Link, Users2 } from "lucide-react";

import { MenuItems } from "@/shared/types/menuItem";

export const menu: MenuItems = [
  { icon: Home, title: "Главная", href: "/" },
  { icon: Users2, title: "О нас", href: "/about" },
  { icon: Headset, title: "Помощь", href: "/support" },
  { icon: Link, title: "Ресурсы", href: "/credits" },
];
