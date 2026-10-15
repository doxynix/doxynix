"use client";
import { MAX_PAGE } from "@doxynix/shared";
import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useQueryStates } from "nuqs";

import { useTRPC } from "@/shared/api/trpc";
import { useDebounce } from "@/shared/lib/hooks/use-debounce";
import { clampIntegerParam } from "@/shared/lib/number-utils";
import { AppButton } from "@/shared/ui/core/button";
import { AppPagination } from "@/shared/ui/kit/app-pagination";

import { bannedEmailParsers } from "../model/banned-email-parsers";
import { useBannedEmailActions } from "../model/use-banned-email-actions";
import { AdminBannedEmailDialog } from "./admin-banned-email-dialog";
import { AdminBannedEmailsSkeleton } from "./admin-banned-emails-skeleton";
import { AdminBannedEmailsTable } from "./admin-banned-emails-table";
import { AdminBannedEmailsToolbar } from "./admin-banned-emails-toolbar";

const PAGE_SIZE = 20;

export function AdminBannedEmailsContainer() {
  const trpc = useTRPC();
  const t = useTranslations("AdminBannedEmails");
  const actions = useBannedEmailActions();

  const [filters] = useQueryStates(bannedEmailParsers);
  const debouncedSearch = useDebounce(filters.search, 500);

  const safePage = clampIntegerParam(filters.page, { fallback: 1, max: MAX_PAGE, min: 1 });

  const { data, isFetching, isLoading } = useQuery(
    trpc.bannedEmail.list.queryOptions(
      {
        from: filters.from ?? undefined,
        limit: PAGE_SIZE,
        page: safePage,
        reason: filters.reason ?? undefined,
        search: debouncedSearch || undefined,
        to: filters.to ?? undefined,
      },
      { placeholderData: (previousData) => previousData },
    ),
  );

  if (isLoading || data == null) {
    return (
      <div className="flex flex-col gap-4">
        <AdminBannedEmailsToolbar />
        <AdminBannedEmailsSkeleton />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <AdminBannedEmailsToolbar />
        <div className="flex items-center gap-3">
          <p className="text-muted-foreground text-sm">
            {t("total_count", {
              filtered: data.meta.filteredCount,
              total: data.meta.totalCount,
            })}
          </p>
          <AdminBannedEmailDialog
            actions={actions}
            trigger={
              <AppButton size="sm">
                <Plus />
                {t("create_action")}
              </AppButton>
            }
          />
        </div>
      </div>

      <AdminBannedEmailsTable
        actions={actions}
        entries={data.items}
      />

      <AppPagination
        isLoading={isFetching}
        meta={data.meta}
      />
    </div>
  );
}
