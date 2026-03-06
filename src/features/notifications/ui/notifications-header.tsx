"use client";

import { X } from "lucide-react";
import { useQueryStates, type inferParserType } from "nuqs";

import { Button } from "@/shared/ui/core/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/core/select";
import { Tabs, TabsList, TabsTrigger } from "@/shared/ui/core/tabs";
import { AppSearch } from "@/shared/ui/kit/app-search";

import { notificationsParsers } from "@/entities/notifications";

import { NotifyTypeSchema } from "@/generated/zod";

import { NotificationsBulkActions } from "./notifications-bulk-actions";
import { NotificationsRepoFilter } from "./notifications-repo-filter";

type Props = {
  stats?: { read: number; total: number; unread: number };
};

type NotificationsFilters = inferParserType<typeof notificationsParsers>;

export function NotificationsHeader({ stats }: Readonly<Props>) {
  const [filters, setFilters] = useQueryStates(notificationsParsers, { shallow: true });

  const tabValue = filters.isRead === null ? "all" : filters.isRead ? "read" : "unread";

  const handleUpdate = <K extends keyof NotificationsFilters>(
    key: K,
    value: NotificationsFilters[K]
  ) => {
    void setFilters({ [key]: value, page: null });
  };

  const TABS = [
    { count: stats?.total, id: "all", label: "All", value: "all" },
    { count: stats?.read, id: "read", label: "Read", value: "read" },
    { count: stats?.unread, id: "unread", label: "Unread", value: "unread" },
  ];

  const handleReset = () => {
    void setFilters({
      isRead: null,
      owner: null,
      page: null,
      repo: null,
      type: null,
    });
  };

  const hasFilters =
    filters.isRead !== null ||
    filters.owner !== null ||
    filters.repo !== null ||
    filters.type !== null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-4">
        <Tabs
          value={tabValue}
          onValueChange={(v) => handleUpdate("isRead", v === "all" ? null : v === "read")}
        >
          <TabsList>
            {TABS.map((t) => (
              <TabsTrigger
                key={t.id}
                value={t.value}
                disabled={!stats || (t.id !== "all" && t.count === 0)}
              >
                {t.label} ({t.count ?? 0})
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <AppSearch placeholder="Search notification..." />

        <NotificationsRepoFilter />

        <Select
          value={filters.type ?? "all"}
          onValueChange={(v) =>
            handleUpdate("type", v === "all" ? null : (v as NotificationsFilters["type"]))
          }
        >
          <SelectTrigger className="">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            <SelectItem value={NotifyTypeSchema.enum.INFO}>Info</SelectItem>
            <SelectItem value={NotifyTypeSchema.enum.SUCCESS}>Success</SelectItem>
            <SelectItem value={NotifyTypeSchema.enum.WARNING}>Warning</SelectItem>
            <SelectItem value={NotifyTypeSchema.enum.ERROR}>Error</SelectItem>
          </SelectContent>
        </Select>

        <Button disabled={!hasFilters} variant="outline" onClick={handleReset} className="px-2">
          Reset
          <X className="h-4 w-4" />
        </Button>
      </div>
      <NotificationsBulkActions stats={stats} />
    </div>
  );
}
