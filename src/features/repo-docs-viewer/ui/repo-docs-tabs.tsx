"use client";

import type { ComponentType } from "react";
import { uniqBy } from "es-toolkit";
import {
  BookOpen,
  ChevronRight,
  Code2,
  FileText,
  GitGraph,
  HistoryIcon,
  Users,
} from "lucide-react";
import { parseAsString, useQueryState } from "nuqs";

import { cn } from "@/shared/lib/cn";
import { AppButton } from "@/shared/ui/core/button";
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
  availableDocs: AvailableDocs;
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

export function RepoDocsTabs({
  activeHeadingId,
  activeTab,
  availableDocs,
  headings,
  items,
}: Readonly<Props>) {
  const [activePath, setActivePath] = useQueryState("path", parseAsString);

  const uniqueTabs = uniqBy(items, (item) => item.value).map((item) =>
    item.value === "CODE_DOC" ? { ...item, id: "CODE_DOC_ROOT" } : item
  );

  const codeDocFiles = availableDocs.filter((doc) => doc.type === "CODE_DOC");

  return (
    <div className="w-72 shrink-0 space-y-4">
      <h2 className="px-2 py-1 font-bold">Documentation</h2>

      <TabsList className="flex h-auto w-full flex-col items-stretch justify-start gap-1 bg-transparent p-0">
        {uniqueTabs.map((item) => {
          const isActive = activeTab === item.value;
          const docMeta = DOCS.find((doc) => doc.id === item.value);
          const isCodeDocRoot = item.value === "CODE_DOC";

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
                  {isCodeDocRoot
                    ? "File Audits"
                    : (docMeta?.label ?? item.value.toLowerCase().replace("_", " "))}
                </span>
                {isActive && <ChevronRight className="text-muted-foreground" />}
              </TabsTrigger>

              {isActive && isCodeDocRoot && codeDocFiles.length > 0 && (
                <div className="animate-in slide-in-from-top-1 fade-in mt-1 mb-3 ml-10 space-y-2 border-l pl-3.5 duration-300">
                  {codeDocFiles.map((file) => {
                    const isFileActive = activePath === file.path;
                    return (
                      <AppButton
                        key={file.id}
                        variant="ghost"
                        onClick={() => void setActivePath(file.path)}
                        className={cn(
                          "hover:text-foreground flex w-full cursor-pointer items-center justify-start gap-1 truncate py-1 text-left text-xs transition-all",
                          isFileActive
                            ? "bg-accent text-foreground font-semibold"
                            : "text-muted-foreground"
                        )}
                      >
                        <FileText /> {file.path?.split("/").pop() ?? "File"}
                      </AppButton>
                    );
                  })}
                </div>
              )}

              {isActive && !isCodeDocRoot && headings.length > 0 && (
                <div className="animate-in slide-in-from-top-1 fade-in mt-1 mb-3 ml-10 space-y-2.5 border-l pl-3.5 duration-300">
                  {headings.map((heading) => (
                    <a
                      key={heading.id}
                      href={`#${heading.id}`}
                      className={cn(
                        "hover:text-foreground block text-xs transition-all",
                        heading.level === 3
                          ? "text-muted-foreground pl-3"
                          : "text-muted-foreground",
                        activeHeadingId === heading.id && "font-semibold"
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
