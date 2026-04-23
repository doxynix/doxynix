"use client";

import { useState, useTransition } from "react";
import { ChevronLeft } from "lucide-react";
import { useTranslations } from "next-intl";
import { parseAsInteger, useQueryState } from "nuqs";

import type { RepoMeta } from "@/shared/api/trpc";
import { cn } from "@/shared/lib/cn";
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
  const [clickedButton, setClickedButton] = useState<"next" | "prev" | null | number>(null);

  const isAnyLoading = isPending || (isLoading ?? false);

  const [prevIsLoading, setPrevIsLoading] = useState(isAnyLoading);

  if (isAnyLoading !== prevIsLoading) {
    setPrevIsLoading(isAnyLoading);
    if (!isAnyLoading) {
      setClickedButton(null);
    }
  }

  const handlePageChange = (targetPage: number, btnType: "next" | "prev" | number) => {
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
            className={cn(navBtnClass, isPrevDisabled ? "opacity-50" : "cursor-pointer")}
          >
            {isPrevLoading ? <Spinner /> : <ChevronLeft />}
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
                tabIndex={isPageDisabled ? -1 : undefined}
                aria-disabled={isPageDisabled}
                onClick={() => !isPageDisabled && handlePageChange(page, page)}
                className={cn(
                  !isPageDisabled && "cursor-pointer",
                  page === meta.currentPage && "text-foreground opacity-100!"
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
              isNextDisabled ? "opacity-50" : "cursor-pointer"
            )}
          >
            <span className="mr-1">{t("next")}</span>
            {isNextLoading ? <Spinner /> : <ChevronLeft className="rotate-180" />}
          </PaginationLink>
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  );
}
