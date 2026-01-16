"use client";

import Link from "next/link";
import { Bell } from "lucide-react";

import { cn } from "@/shared/lib/utils";
import { AppTooltip } from "@/shared/ui/AppTooltip";
import { Button } from "@/shared/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";

// Заглушка! Потом заменишь на пропс или запрос
const notifications = [
  { id: 1, title: "Analysis completed", repos: "vercel/next.js", time: "2 hours ago", read: false },
  { id: 2, title: "New docs available", repos: "my-org/api", time: "1 day ago", read: true },
  { id: 3, title: "Deployment failed", repos: "doxynix/web", time: "2 days ago", read: true },
];

export function NotificationsNav() {
  const unreadCount = notifications.filter((n) => !n.read).length;
  const hasUnread = unreadCount > 0;

  return (
    <DropdownMenu>
      <AppTooltip content="Уведомления">
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="text-muted-foreground relative cursor-pointer"
          >
            <Bell />
            {hasUnread && (
              <span className="bg-primary absolute top-2 right-2 h-2 w-2 rounded-full" />
            )}
          </Button>
        </DropdownMenuTrigger>
      </AppTooltip>
      <DropdownMenuContent className="w-80">
        <div className="flex items-center justify-between p-2">
          <p>Уведомления</p>
          <p className="cursor-pointer text-xs hover:underline">Отметить все</p>
        </div>
        <DropdownMenuSeparator />
        <div className="flex flex-col gap-1 py-1">
          {notifications.length === 0 ? (
            <div className="text-muted-foreground py-4 text-center text-sm">
              Нет новых уведомлений
            </div>
          ) : (
            notifications.slice(0, 5).map((note) => (
              <DropdownMenuItem
                key={note.id}
                className={cn(
                  "flex cursor-pointer flex-row items-center justify-between gap-1 p-3",
                  note.read && "text-muted-foreground"
                )}
              >
                <div>
                  <div className="font-medium">{note.title}</div>
                  <div className="text-muted-foreground text-xs">
                    {note.repos} · {note.time}
                  </div>
                </div>
                {!note.read && <span className="bg-primary h-2 w-2 rounded-full" />}
              </DropdownMenuItem>
            ))
          )}
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="group flex cursor-pointer items-center justify-center">
          <Link
            className="flex w-full items-center justify-center group-hover:underline"
            href="/dashboard/notifications"
          >
            Показать все
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
