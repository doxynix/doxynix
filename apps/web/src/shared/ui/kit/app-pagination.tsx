"use client";

import { useState, useTransition } from "react";
import type { PaginationMeta } from "@doxynix/shared";
import { useTranslations } from "next-intl";
import { parseAsInteger, useQueryState } from "nuqs";

import { cn } from "@/shared/lib/cn";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from "@/shared/ui/core/pagination";

import { Input } from "../core/input";

type Props = {
  className?: string;
  isLoading?: boolean;
  meta: PaginationMeta;
};

export function AppPagination({ className, isLoading, meta }: Readonly<Props>) {
  const t = useTranslations("Common");

  const [page, setPage] = useQueryState("page", parseAsInteger.withDefault(1));

  const [isPending, startTransition] = useTransition();
  const [clickedButton, setClickedButton] = useState<"next" | "prev" | null | number>(null);

  const [inputValue, setInputValue] = useState(String(meta.currentPage));

  const [prevCurrentPage, setPrevCurrentPage] = useState(meta.currentPage);
  if (prevCurrentPage !== meta.currentPage) {
    setPrevCurrentPage(meta.currentPage);
    setInputValue(String(meta.currentPage));
  }

  const isAnyLoading = isPending || (isLoading ?? false);
  const [prevIsLoading, setPrevIsLoading] = useState(isAnyLoading);

  if (isAnyLoading !== prevIsLoading) {
    setPrevIsLoading(isAnyLoading);
    if (!isAnyLoading) {
      setClickedButton(null);
    }
  }

  const handlePageChange = (targetPage: number, btnType: "next" | "prev" | number) => {
    if (targetPage === page) {
      return;
    }

    setClickedButton(btnType);
    startTransition(() => {
      void setPage(targetPage <= 1 ? null : targetPage);
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const target = Number.parseInt(inputValue, 10);

      if (!Number.isNaN(target) && target >= 1 && target <= meta.totalPages) {
        if (target !== meta.currentPage) {
          handlePageChange(target, target);
        }
        e.currentTarget.blur();
      } else {
        setInputValue(String(meta.currentPage));
      }
    } else if (e.key === "Escape") {
      setInputValue(String(meta.currentPage));
      e.currentTarget.blur();
    }
  };

  const handleBlur = () => {
    const target = Number.parseInt(inputValue, 10);

    setInputValue(String(target));
  };

  const isPrevDisabled = isAnyLoading || meta.currentPage <= 1;
  const isNextDisabled = isAnyLoading || meta.currentPage >= meta.totalPages;

  const isPrevLoading = isAnyLoading && clickedButton === "prev";
  const isNextLoading = isAnyLoading && clickedButton === "next";

  const navBtnClass = "gap-1 pl-2.5 pr-4 flex items-center justify-center";

  return (
    <Pagination
      className={cn(
        className,
        isAnyLoading && "opacity-50 transition-opacity",
        meta.totalCount === 0 && "hidden",
      )}
    >
      <PaginationContent className="gap-2">
        <PaginationItem>
          <PaginationPrevious
            className={cn(navBtnClass, isPrevDisabled && "opacity-50")}
            disabled={isPrevDisabled}
            isLoading={isPrevLoading}
            onClick={() => !isPrevDisabled && handlePageChange(meta.currentPage - 1, "prev")}
          />
        </PaginationItem>

        <PaginationItem className="flex items-center gap-1.5 px-1 text-sm text-muted-foreground select-none">
          <span>{t("page")}</span>
          <Input
            aria-label={t("page")}
            className="size-8 px-1 text-center font-medium text-foreground"
            disabled={isAnyLoading}
            inputMode="numeric"
            max={meta.totalPages}
            min={1}
            onBlur={handleBlur}
            onChange={(e) => {
              const digitsOnly = e.target.value.replaceAll(/\D/g, "");
              setInputValue(digitsOnly);
            }}
            onFocus={(e) => e.target.select()}
            onKeyDown={handleKeyDown}
            pattern="[0-9]*"
            value={inputValue}
          />
          <span>
            {t("of")} {meta.totalPages}
          </span>
        </PaginationItem>

        <PaginationItem>
          <PaginationNext
            className={cn(navBtnClass, isNextDisabled && "opacity-50")}
            disabled={isNextDisabled}
            isLoading={isNextLoading}
            onClick={() => !isNextDisabled && handlePageChange(meta.currentPage + 1, "next")}
          />
        </PaginationItem>
      </PaginationContent>

      {meta.capped && (
        <p className="mt-2 text-center text-muted-foreground text-xs">
          {t("capped_hint", { count: meta.filteredCount })}
        </p>
      )}
    </Pagination>
  );
}
