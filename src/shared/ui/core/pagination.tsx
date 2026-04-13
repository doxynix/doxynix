import * as React from "react";
import { ChevronLeft, ChevronRight, MoreHorizontal } from "lucide-react";

import { cn } from "@/shared/lib/cn";
import { Button, buttonVariants, type ButtonProps } from "@/shared/ui/core/button";
import { Link } from "@/i18n/routing";

const Pagination = ({ className, ...props }: React.ComponentProps<"nav">) => (
  <nav
    role="navigation"
    aria-label="pagination"
    className={cn("mx-auto flex w-full justify-center", className)}
    {...props}
  />
);
Pagination.displayName = "Pagination";

const PaginationContent = React.forwardRef<HTMLUListElement, React.ComponentProps<"ul">>(
  ({ className, ...props }, ref) => (
    <ul ref={ref} className={cn("flex flex-row items-center gap-1", className)} {...props} />
  )
);
PaginationContent.displayName = "PaginationContent";

const PaginationItem = React.forwardRef<HTMLLIElement, React.ComponentProps<"li">>(
  ({ className, ...props }, ref) => <li ref={ref} className={cn("", className)} {...props} />
);
PaginationItem.displayName = "PaginationItem";

type BasePaginationLinkProps = Pick<ButtonProps, "size"> & {
  children?: React.ReactNode;
  className?: string;
  disabled?: boolean;
  isActive?: boolean;
};

type PaginationLinkProps = (
  | (React.ComponentProps<"button"> & { href?: never })
  | React.ComponentProps<typeof Link>
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
    className
  );

  if (!("href" in props) || props.href === undefined) {
    const buttonProps = props as React.ComponentProps<"button">;

    return (
      <Button
        disabled={disabled}
        variant="ghost"
        aria-current={isActive ? "page" : undefined}
        className={commonClassName}
        {...buttonProps}
        type="button"
      />
    );
  }

  const { href, onClick, tabIndex, ...linkProps } = props as React.ComponentProps<typeof Link>;
  const effectiveTabIndex = disabled ? -1 : tabIndex;

  return (
    <Link
      {...linkProps}
      href={href}
      tabIndex={effectiveTabIndex}
      aria-current={isActive ? "page" : undefined}
      aria-disabled={disabled || undefined}
      aria-label={props["aria-label"]}
      onClick={(event) => {
        if (disabled) {
          event.preventDefault();
          return;
        }
        onClick?.(event);
      }}
      className={commonClassName}
    />
  );
};
PaginationLink.displayName = "PaginationLink";

const PaginationPrevious = ({
  className,
  ...props
}: React.ComponentProps<typeof PaginationLink>) => (
  <PaginationLink
    size="default"
    aria-label="Go to previous page"
    className={cn("gap-1 pl-2.5", className)}
    {...props}
  >
    <ChevronLeft className="size-4" />
    <span>Back</span>
  </PaginationLink>
);
PaginationPrevious.displayName = "PaginationPrevious";

const PaginationNext = ({ className, ...props }: React.ComponentProps<typeof PaginationLink>) => (
  <PaginationLink
    size="default"
    aria-label="Go to next page"
    className={cn("gap-1 pr-2.5", className)}
    {...props}
  >
    <span>Next</span>
    <ChevronRight className="size-4" />
  </PaginationLink>
);
PaginationNext.displayName = "PaginationNext";

const PaginationEllipsis = ({ className, ...props }: React.ComponentProps<"span">) => (
  <span aria-hidden className={cn("flex size-9 items-center justify-center", className)} {...props}>
    <MoreHorizontal className="size-4" />
    <span className="sr-only">More pages</span>
  </span>
);
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
