"use client";

import { type ComponentType, type ReactNode } from "react";
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
  action?: ReactNode;
  description: ReactNode;
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
