"use client";

import React, { useState, useTransition } from "react";
import { ChevronLeft } from "lucide-react";
import { useTranslations } from "next-intl";
import { parseAsInteger, useQueryState } from "nuqs";

import type { RepoMeta } from "@/shared/api/trpc";
import { cn } from "@/shared/lib/utils";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
} from "@/shared/ui/core/pagination";
import { Spinner } from "@/shared/ui/core/spinner";

type Props = {
  className?: string;
  isLoading?: boolean;
  meta: RepoMeta;
};

export function AppPagination({ className, isLoading, meta }: Readonly<Props>) {
  const t = useTranslations("Common");

  const [page, setPage] = useQueryState(
    "page",
    parseAsInteger.withDefault(1).withOptions({ shallow: true })
  );

  const [isPending, startTransition] = useTransition();
  const [clickedButton, setClickedButton] = useState<"prev" | "next" | number | null>(null);

  const isAnyLoading = isPending || (isLoading ?? false);

  React.useEffect(() => {
    if (!isAnyLoading) {
      setClickedButton(null);
    }
  }, [isAnyLoading]);

  const handlePageChange = (targetPage: number, btnType: "prev" | "next" | number) => {
    if (targetPage === page) return;

    setClickedButton(btnType);
    startTransition(() => {
      void setPage(targetPage <= 1 ? null : targetPage);
    });
  };

  const isPrevDisabled = isAnyLoading || meta.currentPage <= 1;
  const isNextDisabled = isAnyLoading || meta.currentPage >= meta.totalPages;

  const isPrevLoading = isAnyLoading && clickedButton === "prev";
  const isNextLoading = isAnyLoading && clickedButton === "next";

  const navBtnClass = "gap-1 pl-2.5 pr-4 min-w-[100px] flex items-center justify-center";

  return (
    <Pagination
      className={cn(
        className,
        isAnyLoading && "opacity-60 transition-opacity",
        meta.totalCount === 0 && "hidden"
      )}
    >
      <PaginationContent>
        <PaginationItem>
          <PaginationLink
            disabled={isPrevDisabled}
            tabIndex={isPrevDisabled ? -1 : undefined}
            aria-disabled={isPrevDisabled}
            onClick={() => !isPrevDisabled && handlePageChange(meta.currentPage - 1, "prev")}
            className={cn(
              navBtnClass,
              isPrevDisabled ? "pointer-events-none opacity-50" : "cursor-pointer"
            )}
          >
            {isPrevLoading ? (
              <Spinner className="size-4 animate-spin" />
            ) : (
              <ChevronLeft className="size-4" />
            )}
            <span className="ml-1">{t("back")}</span>
          </PaginationLink>
        </PaginationItem>

        {Array.from({ length: meta.totalPages }, (_, i) => i + 1).map((page) => {
          if (
            meta.totalPages > 7 &&
            Math.abs(page - meta.currentPage) > 1 &&
            page !== 1 &&
            page !== meta.totalPages
          ) {
            if (Math.abs(page - meta.currentPage) === 2)
              return (
                <PaginationItem key={page}>
                  <PaginationEllipsis />
                </PaginationItem>
              );
            return null;
          }

          const isCurrentPageLoading = isAnyLoading && clickedButton === page;
          const isPageDisabled = isAnyLoading || page === meta.currentPage;

          return (
            <PaginationItem key={page}>
              <PaginationLink
                disabled={isPageDisabled}
                isActive={page === meta.currentPage}
                aria-disabled={isPageDisabled}
                onClick={() => handlePageChange(page, page)}
                className={cn(
                  "cursor-pointer",
                  page === meta.currentPage && "pointer-events-none opacity-100!"
                )}
              >
                {isCurrentPageLoading ? <Spinner /> : page}
              </PaginationLink>
            </PaginationItem>
          );
        })}

        <PaginationItem>
          <PaginationLink
            disabled={isNextDisabled}
            tabIndex={isNextDisabled ? -1 : undefined}
            aria-disabled={isNextDisabled}
            onClick={() => !isNextDisabled && handlePageChange(meta.currentPage + 1, "next")}
            className={cn(
              navBtnClass,
              "pr-2.5 pl-4",
              isNextDisabled ? "pointer-events-none opacity-50" : "cursor-pointer"
            )}
          >
            <span className="mr-1">{t("next")}</span>
            {isNextLoading ? (
              <Spinner className="size-4 animate-spin" />
            ) : (
              <ChevronLeft className="size-4 rotate-180" />
            )}
          </PaginationLink>
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  );
}
