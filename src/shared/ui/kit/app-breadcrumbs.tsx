"use client";

import { Fragment, type ReactNode } from "react";
import type { Route } from "next";
import Link from "next/link";

import { cn } from "@/shared/lib/cn";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/shared/ui/core/breadcrumb";

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
  separator?: ReactNode;
  showSeparatorAtStart?: boolean;
};

export function AppBreadcrumbs({
  className,
  items,
  listClassName,
  separator = "/",
  showSeparatorAtStart = false,
}: Readonly<Props>) {
  return (
    <Breadcrumb className={className}>
      <BreadcrumbList className={cn("flex-nowrap", listClassName)}>
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          const label = decodeURIComponent(item.label);

          return (
            <Fragment key={item.label + index}>
              {(index > 0 || showSeparatorAtStart) && (
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
                      <Link href={item.href as Route}>
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
