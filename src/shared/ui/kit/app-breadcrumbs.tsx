"use client";

import { Fragment, type ReactNode } from "react";
import type { Route } from "next";

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
import { Link } from "@/i18n/routing";

import { Button } from "../core/button";
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
                        <Button variant="ghost" className="size-7 cursor-pointer">
                          <BreadcrumbEllipsis />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start" className="min-w-45">
                        {collapsedItems.map((collapsed, idx) => (
                          <DropdownMenuItem
                            key={idx}
                            asChild={!!collapsed.href}
                            onSelect={() => {
                              if (collapsed.href == null) collapsed.onClick?.();
                            }}
                            className="cursor-pointer"
                          >
                            {collapsed.href ? (
                              <Link
                                href={collapsed.href as Route}
                                className="w-full cursor-pointer truncate"
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
                    <TruncatedText text={label} className={cn("font-bold", item.className)} />
                  </BreadcrumbPage>
                ) : (
                  <BreadcrumbLink
                    asChild={!!item.href}
                    onClick={item.onClick}
                    className={cn("hover:text-foreground min-w-0 cursor-pointer transition-colors")}
                  >
                    {item.href ? (
                      <Link href={item.href as Route} className="block truncate">
                        <TruncatedText text={label} className={item.className} />
                      </Link>
                    ) : (
                      <TruncatedText text={label} className={item.className} />
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
