"use client";

import type { ComponentType } from "react";
import { BookOpen, ChevronRight, Code2, GitGraph, HistoryIcon, Users } from "lucide-react";

import { cn } from "@/shared/lib/cn";
import { TabsList, TabsTrigger } from "@/shared/ui/core/tabs";

import type { AvailableDocs, DocType } from "@/entities/repo/model/repo.types";

type TabItem = {
  icon: ComponentType<{ className?: string }>;
  id: string;
  status: AvailableDocs[number]["status"];
  value: DocType;
};

type Props = {
  activeHeadingId: string;
  activeTab: DocType;
  headings: { id: string; level: number; text: string }[];
  items: TabItem[];
};

const DOCS = [
  { icon: BookOpen, id: "README", label: "Overview" },
  { icon: Code2, id: "API", label: "API Reference" },
  { icon: GitGraph, id: "ARCHITECTURE", label: "Architecture" },
  { icon: Users, id: "CONTRIBUTING", label: "How to guides" },
  { icon: HistoryIcon, id: "CHANGELOG", label: "History" },
] as const;

export function RepoDocsTabs({ activeHeadingId, activeTab, headings, items }: Readonly<Props>) {
  return (
    <div className="w-72 shrink-0 space-y-4">
      <h2 className="px-2 py-1 font-bold">Documentation</h2>

      <TabsList className="flex h-auto w-full flex-col items-stretch justify-start gap-1 bg-transparent p-0">
        {items.map((item) => {
          const isActive = activeTab === item.value;
          const docMeta = DOCS.find((doc) => doc.id === item.value);

          return (
            <div key={item.id} className="flex w-full flex-col">
              <TabsTrigger
                value={item.value}
                className={cn(
                  "w-full items-center justify-start gap-3 p-3 transition-all duration-200"
                )}
              >
                <item.icon className={cn(isActive ? "text-foreground" : "text-muted-foreground")} />
                <span className="grow text-left text-sm font-medium">
                  {docMeta?.label ?? item.value.toLowerCase().replace("_", " ")}
                </span>
                {isActive && <ChevronRight className="text-muted-foreground size-3" />}
              </TabsTrigger>

              {isActive && headings.length > 0 && (
                <div className="animate-in slide-in-from-top-1 fade-in mt-1 mb-3 ml-10 space-y-2.5 border-l pl-3.5 duration-300">
                  {headings.map((heading) => (
                    <a
                      key={heading.id}
                      href={`#${heading.id}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        const el = document.getElementById(heading.id);
                        if (el != null) {
                          el.scrollIntoView();
                        }
                      }}
                      className={cn(
                        "hover:text-foreground block text-xs transition-all",
                        heading.level === 3
                          ? "text-muted-foreground pl-3"
                          : "text-muted-foreground",
                        activeHeadingId === heading.id && "text-primary font-semibold"
                      )}
                    >
                      {heading.text}
                    </a>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </TabsList>
    </div>
  );
}
