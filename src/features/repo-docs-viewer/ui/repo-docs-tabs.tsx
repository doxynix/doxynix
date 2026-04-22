"use client";

import { ChevronRight } from "lucide-react";

import { type AvailableDocs, type DocType } from "@/shared/api/trpc";
import { cn } from "@/shared/lib/cn";
import { TabsList, TabsTrigger } from "@/shared/ui/core/tabs";

type TabItem = {
  icon: React.ComponentType<{ className?: string }>;
  id: string;
  status: AvailableDocs[number]["status"];
  value: DocType;
};

type Props = {
  activeTab: DocType;
  items: TabItem[];
};

export function RepoDocsTabs({ activeTab, items }: Readonly<Props>) {
  return (
    <div className="w-72 shrink-0 space-y-4">
      <h2 className="px-2 py-1 font-bold">Documentation</h2>
      <TabsList className="flex h-auto w-full flex-col items-stretch justify-start gap-1 p-0">
        {items.map((item) => {
          const isActive = activeTab === item.value;

          return (
            <TabsTrigger
              key={item.id}
              value={item.value}
              className={cn("w-full items-center justify-start gap-3 p-3")}
            >
              <item.icon className={cn(isActive ? "text-foreground" : "text-muted-foreground")} />
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
