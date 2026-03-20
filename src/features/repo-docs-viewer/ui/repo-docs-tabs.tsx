"use client";

import { ChevronRight } from "lucide-react";

import { type DocType } from "@/shared/api/trpc";
import { cn } from "@/shared/lib/utils";
import { TabsList, TabsTrigger } from "@/shared/ui/core/tabs";

type TabItem = {
  icon: React.ComponentType<{ className?: string }>;
  id: string;
  value: DocType;
};

type Props = {
  activeTab: DocType;
  items: TabItem[];
};

export function RepoDocsTabs({ activeTab, items }: Readonly<Props>) {
  return (
    <div className="w-64 shrink-0 space-y-4">
      <h2 className="px-2 py-1 font-bold">Documentation</h2>
      <TabsList className="flex h-auto w-full flex-col items-stretch justify-start gap-1 p-0">
        {items.map((item) => {
          const isActive = activeTab === item.value;

          return (
            <TabsTrigger
              key={item.id}
              value={item.value}
              className={cn(
                "relative flex w-full items-center justify-start gap-3 rounded-lg px-3 py-2.5 shadow-none transition-all",
                "text-muted-foreground"
              )}
            >
              <item.icon
                className={cn(
                  "size-4 shrink-0",
                  isActive ? "text-foreground" : "text-muted-foreground"
                )}
              />
              <span className="grow text-left text-sm font-medium capitalize">
                {item.value.toLowerCase().replace("_", " ")}
              </span>
              {isActive && <ChevronRight className="size-3" />}
            </TabsTrigger>
          );
        })}
      </TabsList>
    </div>
  );
}
