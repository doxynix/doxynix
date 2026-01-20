"use client";

import { useState, useTransition } from "react";
import type { Route } from "next";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft } from "lucide-react";

import { cn } from "@/shared/lib/utils";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
} from "@/shared/ui/pagination";
import { Spinner } from "@/shared/ui/spinner";

type Props = {
  className?: string;
  currentPage: number;
  totalPages: number;
};

export function AppPagination({ className, currentPage, totalPages }: Props) {
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
      className={cn(className, isPending && "pointer-events-none opacity-60 transition-opacity")}
    >
      <PaginationContent>
        <PaginationItem>
          <PaginationLink
            href={createPageURL(currentPage - 1) as Route}
            onClick={(e) => currentPage > 1 && handlePageClick(e, currentPage - 1, "prev")}
            className={cn(
              navBtnClass,
              currentPage <= 1 ? "pointer-events-none opacity-50" : "cursor-pointer"
            )}
            aria-disabled={currentPage <= 1}
          >
            {isPrevLoading ? (
              <Spinner className="h-4 w-4 animate-spin" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
            <span className="ml-1">Back</span>
          </PaginationLink>
        </PaginationItem>

        {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
          if (
            totalPages > 7 &&
            Math.abs(page - currentPage) > 1 &&
            page !== 1 &&
            page !== totalPages
          ) {
            if (Math.abs(page - currentPage) === 2)
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
                isActive={page === currentPage}
                onClick={(e) => handlePageClick(e, page, "page")}
                className={cn("cursor-pointer", page === currentPage && "pointer-events-none")}
              >
                {page}
              </PaginationLink>
            </PaginationItem>
          );
        })}

        <PaginationItem>
          <PaginationLink
            href={createPageURL(currentPage + 1) as Route}
            onClick={(e) => currentPage < totalPages && handlePageClick(e, currentPage + 1, "next")}
            className={cn(
              navBtnClass,
              "pr-2.5 pl-4",
              currentPage >= totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"
            )}
            aria-disabled={currentPage >= totalPages}
          >
            <span className="mr-1">Next</span>
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
