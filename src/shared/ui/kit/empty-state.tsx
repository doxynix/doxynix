"use client";

import React, { type ComponentType } from "react";
import { CircleOff } from "lucide-react";

import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/shared/ui/core/empty";

type Props = {
  action?: React.ReactNode;
  description: React.ReactNode;
  icon?: ComponentType<{ className?: string }>;
  title: string;
};

export function EmptyState({
  action,
  description,
  icon: Icon = CircleOff,
  title,
}: Readonly<Props>) {
  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Icon />
        </EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>

      {action && <EmptyContent>{action}</EmptyContent>}
    </Empty>
  );
}
