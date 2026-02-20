"use client";

import { useState, useTransition } from "react";
import type { Route } from "next";
import { useSearchParams } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { useTranslations } from "next-intl";

import { cn } from "@/shared/lib/utils";
import type { RepoMeta } from "@/shared/types/repo";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
} from "@/shared/ui/core/pagination";
import { Spinner } from "@/shared/ui/core/spinner";

import { usePathname, useRouter } from "@/i18n/routing";

type Props = {
  className?: string;
  meta: RepoMeta;
};

export function AppPagination({ className, meta }: Props) {
  const t = useTranslations("Common");

  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [isPending, startTransition] = useTransition();
  const [clickedButton, setClickedButton] = useState<"prev" | "next" | "page">("page");

  const handlePageClick = (e: React.MouseEvent, page: number, btn: "prev" | "next" | "page") => {
    e.preventDefault();
    setClickedButton(btn);
    startTransition(() => {
      router.push(createPageURL(page) as Route, { scroll: false });
      setClickedButton("page");
    });
  };

  const createPageURL = (pageNumber: number | string) => {
    const params = new URLSearchParams(searchParams);
    const targetPage = Number(pageNumber);

    if (targetPage <= 1) {
      params.delete("page");
    } else {
      params.set("page", targetPage.toString());
    }

    const str = params.toString();
    return str ? `${pathname}?${str}` : pathname;
  };

  const isPrevLoading = isPending && clickedButton === "prev";
  const isNextLoading = isPending && clickedButton === "next";
  const navBtnClass = "gap-1 pl-2.5 pr-4 min-w-[100px] flex items-center justify-center";

  return (
    <Pagination
      className={cn(
        className,
        isPending && "pointer-events-none opacity-60 transition-opacity",
        meta.totalCount === 0 && "hidden"
      )}
    >
      <PaginationContent>
        <PaginationItem>
          <PaginationLink
            href={createPageURL(meta.currentPage - 1) as Route}
            onClick={(e) =>
              meta.currentPage > 1 && handlePageClick(e, meta.currentPage - 1, "prev")
            }
            className={cn(
              navBtnClass,
              meta.currentPage <= 1 ? "pointer-events-none opacity-50" : "cursor-pointer"
            )}
            aria-disabled={meta.currentPage <= 1}
          >
            {isPrevLoading ? (
              <Spinner className="h-4 w-4 animate-spin" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
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

          return (
            <PaginationItem key={page}>
              <PaginationLink
                href={createPageURL(page) as Route}
                isActive={page === meta.currentPage}
                onClick={(e) => handlePageClick(e, page, "page")}
                className={cn("cursor-pointer", page === meta.currentPage && "pointer-events-none")}
              >
                {page}
              </PaginationLink>
            </PaginationItem>
          );
        })}

        <PaginationItem>
          <PaginationLink
            href={createPageURL(meta.currentPage + 1) as Route}
            onClick={(e) =>
              meta.currentPage < meta.totalPages && handlePageClick(e, meta.currentPage + 1, "next")
            }
            className={cn(
              navBtnClass,
              "pr-2.5 pl-4",
              meta.currentPage >= meta.totalPages
                ? "pointer-events-none opacity-50"
                : "cursor-pointer"
            )}
            aria-disabled={meta.currentPage >= meta.totalPages}
          >
            <span className="mr-1">{t("next")}</span>
            {isNextLoading ? (
              <Spinner className="h-4 w-4 animate-spin" />
            ) : (
              <ChevronLeft className="h-4 w-4 rotate-180" />
            )}
          </PaginationLink>
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  );
}
