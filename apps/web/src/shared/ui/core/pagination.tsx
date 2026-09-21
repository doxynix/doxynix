"use client";

import { type ComponentProps, forwardRef, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, MoreHorizontal } from "lucide-react";
import { useTranslations } from "next-intl";

import { Link } from "@/shared/i18n/navigation";
import { cn } from "@/shared/lib/cn";
import { AppButton, type ButtonProps, buttonVariants } from "@/shared/ui/core/button";

const Pagination = ({ className, ...props }: ComponentProps<"nav">) => {
  const tCommon = useTranslations("Common");
  return (
    <nav
      aria-label={tCommon("pagination")}
      className={cn("mx-auto flex w-full justify-center", className)}
      {...props}
    />
  );
};
Pagination.displayName = "Pagination";

const PaginationContent = forwardRef<HTMLUListElement, ComponentProps<"ul">>(
  ({ className, ...props }, ref) => (
    <ul
      className={cn("flex flex-row items-center gap-1", className)}
      ref={ref}
      {...props}
    />
  ),
);
PaginationContent.displayName = "PaginationContent";

const PaginationItem = forwardRef<HTMLLIElement, ComponentProps<"li">>(
  ({ className, ...props }, ref) => (
    <li
      className={cn("", className)}
      ref={ref}
      {...props}
    />
  ),
);
PaginationItem.displayName = "PaginationItem";

type BasePaginationLinkProps = Pick<ButtonProps, "size"> & {
  children?: ReactNode;
  className?: string;
  disabled?: boolean;
  isActive?: boolean;
};

type PaginationLinkProps = (
  | (ComponentProps<"button"> & { href?: never })
  | ComponentProps<typeof Link>
) &
  BasePaginationLinkProps;

const PaginationLink = ({
  className,
  disabled,
  isActive,
  size = "icon",
  ...props
}: PaginationLinkProps) => {
  const commonClassName = cn(
    buttonVariants({
      size,
      variant: isActive ? "outline" : "ghost",
    }),
    className,
  );

  if (!("href" in props) || props.href == null) {
    const buttonProps = props as ComponentProps<"button">;

    return (
      <AppButton
        aria-current={isActive ? "page" : undefined}
        className={commonClassName}
        disabled={disabled}
        variant="ghost"
        {...buttonProps}
        type="button"
      />
    );
  }

  const { href, onClick, tabIndex, ...linkProps } = props as ComponentProps<typeof Link>;
  const effectiveTabIndex = disabled ? -1 : tabIndex;

  return (
    <Link
      {...linkProps}
      aria-current={isActive ? "page" : undefined}
      aria-disabled={disabled || undefined}
      aria-label={props["aria-label"]}
      className={commonClassName}
      href={href}
      onClick={(event) => {
        if (disabled) {
          event.preventDefault();
          return;
        }
        onClick?.(event);
      }}
      tabIndex={effectiveTabIndex}
    />
  );
};
PaginationLink.displayName = "PaginationLink";

const PaginationPrevious = ({ className, ...props }: ComponentProps<typeof PaginationLink>) => {
  const tCommon = useTranslations("Common");
  return (
    <PaginationLink
      aria-label={tCommon("go_to_previous_page")}
      className={cn("gap-1 pl-2.5", className)}
      size="default"
      {...props}
    >
      <ChevronLeft />
      <span>{tCommon("back")}</span>
    </PaginationLink>
  );
};
PaginationPrevious.displayName = "PaginationPrevious";

const PaginationNext = ({ className, ...props }: ComponentProps<typeof PaginationLink>) => {
  const tCommon = useTranslations("Common");
  return (
    <PaginationLink
      aria-label={tCommon("go_to_next_page")}
      className={cn("gap-1 pr-2.5", className)}
      size="default"
      {...props}
    >
      <span>{tCommon("next")}</span>
      <ChevronRight />
    </PaginationLink>
  );
};
PaginationNext.displayName = "PaginationNext";

const PaginationEllipsis = ({ className, ...props }: ComponentProps<"span">) => {
  const tCommon = useTranslations("Common");
  return (
    <span
      aria-hidden
      className={cn("flex size-9 items-center justify-center", className)}
      {...props}
    >
      <MoreHorizontal />
      <span className="sr-only">{tCommon("more_pages")}</span>
    </span>
  );
};
PaginationEllipsis.displayName = "PaginationEllipsis";

export {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
};
