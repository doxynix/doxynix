import { AlertCircle, FileEdit } from "lucide-react";

import type { FileMeta } from "@/shared/api/trpc";
import { cn } from "@/shared/lib/cn";
import { formatSize } from "@/shared/lib/size-format";

import type { EditorStats } from "../model/editor-stats.types";

type Props = {
  meta: FileMeta;
  readOnly: boolean;
  stats: EditorStats;
};

export function RepoStatusBar({ meta, readOnly, stats }: Readonly<Props>) {
  return (
    <div className="bg-card flex items-center justify-between px-3 py-1.5 font-mono text-[11px]">
      <div className="flex items-center gap-3 font-semibold">
        <span
          className={cn(
            "rounded border p-px text-[10px] font-bold uppercase",
            readOnly
              ? "bg-info/10 text-info border-info/50"
              : "bg-success/10 text-success border-success/50"
          )}
        >
          {readOnly ? "View" : "Edit"}
        </span>
        <span>{meta.name}</span>
        {stats.isDirty && (
          <span className="text-warning flex animate-pulse items-center gap-1">
            <FileEdit className="size-3" />
            Modified
          </span>
        )}
        {stats.errors > 0 && (
          <div className="text-destructive flex items-center gap-1 font-bold">
            <AlertCircle className="size-3" />
            {stats.errors}
          </div>
        )}
      </div>

      <div className="text-muted-foreground flex items-center gap-3">
        <span>
          Ln {stats.line}, Col {stats.col}
        </span>
        <span>Lines: {stats.totalLines}</span>
        <span>{formatSize(meta.size)}</span>
      </div>
    </div>
  );
}
