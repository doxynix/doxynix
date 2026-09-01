"use client";

import { Fragment, type ReactNode } from "react";
import type { Route } from "next";

import { Link } from "@/shared/i18n/navigation";
import { cn } from "@/shared/lib/cn";
import {
  Breadcrumb,
  BreadcrumbEllipsis,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/shared/ui/core/breadcrumb";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/ui/core/dropdown-menu";

import { AppButton } from "../core/button";
import { TruncatedText } from "./truncated-text";

type BreadcrumbItemConfig = {
  className?: string;
  href?: string;
  label: string;
  onClick?: () => void;
};

type Props = {
  className?: string;
  items: BreadcrumbItemConfig[];
  listClassName?: string;
  maxItems?: number;
  separator?: ReactNode;
  showSeparatorAtStart?: boolean;
};

export function AppBreadcrumbs({
  className,
  items,
  listClassName,
  maxItems = 4,
  separator = "/",
  showSeparatorAtStart = false,
}: Readonly<Props>) {
  const isCollapsed = items.length > maxItems;

  const visibleItems = isCollapsed
    ? [items[0], ...items.slice(-2)].filter((i): i is BreadcrumbItemConfig => !!i)
    : items;

  const collapsedItems = isCollapsed ? items.slice(1, -2) : [];

  return (
    <Breadcrumb className={className}>
      <BreadcrumbList className={cn("flex-nowrap gap-1", listClassName)}>
        {showSeparatorAtStart && (
          <BreadcrumbSeparator className="shrink-0">{separator}</BreadcrumbSeparator>
        )}

        {visibleItems.map((item, index) => {
          const isLast = index === visibleItems.length - 1;
          const label = decodeURIComponent(item.label);

          const showEllipsis = isCollapsed && index === 1;

          return (
            <Fragment key={`${item.label}-${index}`}>
              {showEllipsis && (
                <>
                  <BreadcrumbSeparator className="shrink-0">{separator}</BreadcrumbSeparator>
                  <BreadcrumbItem>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <AppButton
                          aria-label="Show hidden elements"
                          className="size-7 cursor-pointer"
                          size="icon"
                          variant="ghost"
                        >
                          <BreadcrumbEllipsis />
                        </AppButton>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start" className="min-w-45">
                        {collapsedItems.map((collapsed, idx) => (
                          <DropdownMenuItem
                            asChild={!!collapsed.href}
                            className="cursor-pointer"
                            key={idx}
                            onSelect={() => {
                              if (collapsed.href == null) {
                                collapsed.onClick?.();
                              }
                            }}
                          >
                            {collapsed.href ? (
                              <Link
                                className="w-full cursor-pointer truncate"
                                href={collapsed.href as Route}
                                onClick={collapsed.onClick}
                              >
                                {decodeURIComponent(collapsed.label)}
                              </Link>
                            ) : (
                              <span className="w-full truncate">
                                {decodeURIComponent(collapsed.label)}
                              </span>
                            )}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator className="shrink-0">{separator}</BreadcrumbSeparator>
                </>
              )}

              {index > 0 && !showEllipsis && (
                <BreadcrumbSeparator className="shrink-0">{separator}</BreadcrumbSeparator>
              )}

              <BreadcrumbItem className="min-w-0 shrink">
                {isLast ? (
                  <BreadcrumbPage className="w-full min-w-0">
                    <TruncatedText className={cn("font-bold", item.className)} text={label} />
                  </BreadcrumbPage>
                ) : (
                  <BreadcrumbLink
                    asChild={!!item.href}
                    className={cn("min-w-0 cursor-pointer transition-colors hover:text-foreground")}
                    onClick={item.onClick}
                  >
                    {item.href ? (
                      <Link className="block truncate" href={item.href}>
                        <TruncatedText className={item.className} text={label} />
                      </Link>
                    ) : (
                      <TruncatedText className={item.className} text={label} />
                    )}
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
            </Fragment>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
