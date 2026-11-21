"use client";

import type { ReactNode } from "react";

import { Label } from "@/shared/ui/core/label";

type SectionProps = {
  children: ReactNode;
  description?: string;
  title: string;
};

export function AppearanceSection({ children, description, title }: Readonly<SectionProps>) {
  return (
    <section className="flex flex-col gap-4 border-t pt-6 first:border-t-0 first:pt-0">
      <div>
        <h3 className="font-semibold text-sm">{title}</h3>
        {description != null && (
          <p className="mt-0.5 text-muted-foreground text-xs">{description}</p>
        )}
      </div>

      {children}
    </section>
  );
}

type RowProps = {
  children: ReactNode;
  description: string;
  htmlFor?: string;
  title: string;
};

export function AppearanceRow({ children, description, htmlFor, title }: Readonly<RowProps>) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
      <div className="min-w-0">
        {htmlFor == null ? (
          <p className="font-medium text-sm">{title}</p>
        ) : (
          <Label
            className="font-medium text-sm"
            htmlFor={htmlFor}
          >
            {title}
          </Label>
        )}
        <p className="mt-0.5 text-muted-foreground text-xs">{description}</p>
      </div>

      <div className="flex shrink-0 items-center">{children}</div>
    </div>
  );
}
