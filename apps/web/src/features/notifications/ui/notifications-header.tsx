"use client";

import { NotifyType } from "@doxynix/shared";
import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useQueryStates } from "nuqs";

import { AppButton } from "@/shared/ui/core/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/core/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/ui/core/tabs";
import { AppSearch } from "@/shared/ui/kit/app-search";

import {
  type NotificationsParsersState,
  notificationsParsers,
} from "@/entities/notification/model/notifications-parsers";

import { NotificationsBulkActions } from "./notifications-bulk-actions";
import { NotificationsRepoFilter } from "./notifications-repo-filter";

type Props = {
  stats?: { read: number; total: number; unread: number };
};

type TabItem = { count?: number; id: string; label: string; value: string };

export function NotificationsHeader({ stats }: Readonly<Props>) {
  const [filters, setFilters] = useQueryStates(notificationsParsers);

  const tabValue = filters.isRead === null ? "all" : filters.isRead ? "read" : "unread";

  const handleUpdate = <K extends keyof NotificationsParsersState>(
    key: K,
    value: NotificationsParsersState[K],
  ) => {
    void setFilters({ [key]: value, page: null });
  };

  const t = useTranslations("Notifications");
  const tCommon = useTranslations("Common");

  const TABS = [
    { count: stats?.total, id: "all", label: t("tab_all"), value: "all" },
    { count: stats?.read, id: "read", label: t("tab_read"), value: "read" },
    { count: stats?.unread, id: "unread", label: t("tab_unread"), value: "unread" },
  ] satisfies TabItem[];

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
          onValueChange={(v) => handleUpdate("isRead", v === "all" ? null : v === "read")}
          value={tabValue}
        >
          <TabsList aria-label={t("filter_by_status")}>
            {TABS.map((t) => (
              <TabsTrigger
                className="m-0.5"
                disabled={!stats || (t.id !== "all" && t.count === 0)}
                key={t.id}
                value={t.value}
              >
                {`${t.label} (${t.count ?? 0})`}
              </TabsTrigger>
            ))}
          </TabsList>
          {TABS.map((t) => (
            <TabsContent
              className="hidden"
              key={t.id}
              value={t.value}
            />
          ))}
        </Tabs>

        <AppSearch placeholder={t("search_placeholder")} />

        <NotificationsRepoFilter />

        <Select
          onValueChange={(v) =>
            handleUpdate("type", v === "all" ? null : (v as NotificationsParsersState["type"]))
          }
          value={filters.type ?? "all"}
        >
          <SelectTrigger
            aria-label={t("filter_by_type")}
            className=""
          >
            <SelectValue placeholder={t("type_placeholder")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("all_types")}</SelectItem>
            <SelectItem value={NotifyType.INFO}>{t("type_info")}</SelectItem>
            <SelectItem value={NotifyType.SUCCESS}>{t("type_success")}</SelectItem>
            <SelectItem value={NotifyType.WARNING}>{t("type_warning")}</SelectItem>
            <SelectItem value={NotifyType.ERROR}>{t("type_error")}</SelectItem>
          </SelectContent>
        </Select>

        <AppButton
          className="px-2"
          disabled={!hasFilters}
          onClick={handleReset}
          variant="outline"
        >
          {tCommon("reset")}
          <X />
        </AppButton>
      </div>
      <NotificationsBulkActions stats={stats} />
    </div>
  );
}
